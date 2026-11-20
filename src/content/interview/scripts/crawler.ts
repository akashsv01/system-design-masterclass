import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';

const g = (comps: [string, string, string, string, number, number][], links: [string, string, string?][]) => ({
  comps: comps.map(([id, type, kind, label, x, y]) => ({ id, type, kind: kind as never, label, x, y })),
  links: links.map(([from, to, label]) => ({ id: `${from}-${to}`, from, to, label })),
});

export const crawler: InterviewScript = {
  caseId: 'case-crawler',
  track: 'hld',
  doLine: 'Design a polite web crawler: follow a URL from the frontier to a stored page, balance per-host limits against workers, then survive a frontier outage',
  skills: ['architecture', 'capacity', 'reliability', 'messaging'],
  brief: {
    interviewer: { name: 'Sam', role: 'data engineer on the listings team' },
    intro: 'We collect event listings from the websites of about 50,000 venues. Some are one page; some have thousands. We visit each site once a day, and a small venue’s server can fall over if we are careless.',
    users: 'Our listings team, who use the extracted events, and the venues whose websites we visit.',
    needs: ['Visit every venue site once a day and download its pages', 'Pull events and new links out of each page', 'Store the page and the extracted events with where and when they were found'],
    mustHold: ['No venue sees more than about one request a second from us', 'We obey each site’s robots.txt (its rules for crawlers)', 'The same page is not fetched or stored over and over'],
    constraints: ['50,000 venue sites, some with thousands of pages', 'About 1 request a second per site at most', 'A page fetch takes about 1 second', 'Revisit every site daily'],
    outOfScope: ['Reading pages that need a login', 'Running JavaScript in pages', 'How events are extracted from a page'],
    terms: [
      { term: 'frontier', meaning: 'the list of URLs still to be fetched, grouped by site, with the earliest time each site may be visited again' },
      { term: 'politeness', meaning: 'limiting how often we hit one site so we never overload it' },
      { term: 'robots.txt', meaning: 'a file on each site saying which pages crawlers may visit, and sometimes how slowly to go' },
      { term: 'crawler trap', meaning: 'a site structure that generates endless new URLs, such as a calendar with a “next month” link forever' },
    ],
    firstMove: 'A URL is waiting to be fetched. Show me how it goes from the list of URLs to a stored page, and which part makes sure we are not hammering that venue.',
  },
  palette: [
    { type: 'frontier', kind: 'queue', name: 'URL frontier', blurb: 'One queue per site holding URLs to fetch, each with the next time that site may be visited.' },
    { type: 'politeness', kind: 'scheduler', name: 'Politeness scheduler', blurb: 'Hands a site to one fetcher at a time, and only when its waiting time has passed.' },
    { type: 'fetcher', kind: 'worker', name: 'Fetcher', blurb: 'Downloads a page from a venue’s website and hands it on.' },
    { type: 'robots', kind: 'cache', name: 'robots.txt cache', blurb: 'A recent copy of each site’s rules, so we don’t re-download them for every page.' },
    { type: 'sites', kind: 'ext', name: 'Venue websites', blurb: 'Other people’s servers. Some are slow; none is ours to overload.' },
    { type: 'pages', kind: 'storage', name: 'Page store', blurb: 'Keeps each downloaded page and its fingerprint (a hash of its content).' },
    { type: 'parser', kind: 'worker', name: 'Parser', blurb: 'Reads a page, extracts events and the links it contains.' },
    { type: 'seen', kind: 'db', name: 'Seen-URL store', blurb: 'Remembers every URL and content fingerprint already handled, so repeats are skipped.' },
    { type: 'events', kind: 'db', name: 'Events store', blurb: 'The structured events found, with source URL and time.' },
  ],
  verbs: ['sends request', 'reads from', 'writes to', 'reads and writes', 'publishes event', 'delivers to', 'triggers', 'calls'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Ask what you need before you draw. Answers come from the brief; where it leaves a choice, state your assumption.',
      question: 'Before you design, what would you ask me? Pick the questions whose answers change the design.',
      activity: {
        kind: 'clarify',
        questions: [
          { id: 'scope', q: 'Which sites do we crawl, and how much of each?', a: 'About 50,000 venue sites we have a list for. Some have thousands of pages. We stay on those sites and do not follow links out to other sites.' },
          { id: 'rate', q: 'How hard may we hit one site?', a: 'About one request a second per site at most, and we always honour robots.txt, including a slower “crawl delay” if the site asks for one.' },
          { id: 'fresh', q: 'How often do we revisit?', a: 'Once a day for every site. Big venues will need more often later, but not in this version.' },
          { id: 'dup', q: 'Do the same pages show up more than once?', a: 'Yes. A page can appear under several URLs, and calendars can link to “next month” forever. We must not loop or store duplicates.' },
          { id: 'speed', q: 'How long does a fetch take?', a: 'About one second, but some sites take much longer, and a few time out.' },
          { id: 'output', q: 'What do we keep?', a: 'The extracted events with their source URL and time, plus the raw page so we can re-extract later.' },
        ],
        assumptions: [
          { id: 'delay', q: 'What is the wait between requests to one site?', options: [
            { id: 'fixed', label: 'A fixed one second for every site', consequence: 'Simple, but a site that asks for a slower pace in robots.txt would be ignored, which breaks a must-hold.' },
            { id: 'robots-delay', label: 'One second, or the site’s own crawl delay if it is longer', consequence: 'Respects each site, but the frontier must track a different wait per site.' },
          ] },
          { id: 'frontier-home', q: 'Where does the frontier live?', options: [
            { id: 'durable', label: 'In a durable, replicated store', consequence: 'It survives a crash with its queues and timers intact, at the cost of a store that must be fast enough for every fetch.' },
            { id: 'memory', label: 'In memory on one server', consequence: 'Fast, but a restart forgets what is queued and when each site was last visited, so you may hit sites too soon.' },
          ] },
        ],
      },
      help: {
        hint: 'Which answers say whose servers we are touching, and which say how we avoid fetching the same page twice?',
        walkthrough: [
          { text: 'One request a second per site, with robots.txt honoured, is the limit that shapes the frontier.' },
          { text: 'A fetch takes a second, so one fetcher can do one request a second to one site: more fetchers only help across different sites.' },
          { text: 'Duplicate URLs and endless calendars mean every URL must be checked against what has been seen.' },
          { text: 'Some sites are slow, so a slow site must not tie up fetchers that others need.' },
        ],
        solution: [{ type: 'list', items: ['50,000 sites; stay on-site.', 'At most about 1 request a second per site; obey robots.txt (and its crawl delay).', 'Revisit daily.', 'The same page can have many URLs; calendars can be endless.', 'Fetches take about 1 second; some sites are much slower.'] }],
        why: 'These answers decide how the frontier is organised (per site, with timers), how duplicates are caught, and why slow sites need their own protection.',
      },
      lessons: ['requirements', 'rate-limiting'],
    },
    {
      id: 'design', title: 'Design', intro: 'Place the parts a URL passes through and connect them. Then trace a URL from the frontier to a stored page.',
      question: 'A URL is waiting. Show me how it becomes a stored page, and which part keeps us polite to that venue.',
      activity: {
        kind: 'build', flavor: 'architecture',
        starter: g([['s-frontier', 'frontier', 'queue', 'URL frontier', 70, 200], ['s-polite', 'politeness', 'scheduler', 'Politeness scheduler', 300, 200]], [['s-frontier', 's-polite', 'delivers to']]),
        traces: [
          { id: 'crawl', label: 'A URL goes from the frontier to a stored page', token: 'https://venue.example/events/42', from: { type: 'frontier' }, to: { type: 'pages' } },
          { id: 'links', label: 'A new link found on a page reaches the frontier', token: '/events/43', from: { type: 'parser' }, to: { type: 'frontier' } },
        ],
      },
      help: {
        hint: 'What stops two fetchers from hitting the same site at the same moment, and where do links found on the page go?',
        walkthrough: [
          { text: 'The frontier keeps one queue per site; the Politeness scheduler only hands out a site whose wait has passed, and to one fetcher at a time.', focus: ['frontier', 'politeness', 'fetcher'] },
          { text: 'The Fetcher checks the cached robots.txt, then downloads the page from the venue’s website.', focus: ['fetcher', 'robots', 'sites'] },
          { text: 'The page is stored, and a Parser extracts events and links.', focus: ['fetcher', 'pages', 'parser', 'events'] },
          { text: 'The Parser checks each link against the Seen-URL store and adds new ones to the frontier.', focus: ['parser', 'seen', 'frontier'] },
        ],
        solution: [
          { type: 'p', text: '**Politeness is a property of the frontier, not of the fetchers.** Each site has its own queue and a “next allowed time”. The scheduler gives a site to one fetcher at a time, so no coordination between fetchers is needed. Every new link is normalised and checked against the Seen-URL store before it re-enters the frontier.' },
          { type: 'code', lang: 'pseudo', code: 'frontier[host] = queue of URLs, next_allowed_at\nschedule():\n  host = earliest host with next_allowed_at <= now and not in_flight\n  mark in_flight; hand (host, next URL) to a fetcher\non fetch done: next_allowed_at = now + max(1s, crawl_delay); clear in_flight' },
        ],
        why: 'Keeping the per-site wait in the frontier makes politeness hold however many fetchers there are, and the seen-URL check keeps duplicates and traps from growing the work.',
      },
      lessons: ['queues', 'rate-limiting', 'caching'],
    },
    {
      id: 'hosts', title: 'Per-site limits', intro: 'A site gets one fetch a second, so extra fetchers only help across different sites. Run the queue, then slow one site down.',
      question: 'One big venue starts answering in 6 seconds instead of 1. How do you keep the other sites flowing?',
      activity: {
        kind: 'queue', what: 'URLs from many sites waiting for a fetcher',
        arrival: [20, 40, 60], workers: [20, 50, 100], serviceMs: 1000,
        slow: { from: 10, to: 40, serviceMs: 6000, what: 'A big venue answers in 6 seconds instead of 1, and fetchers stuck on it cannot serve other sites.' },
        timeoutS: 3,
        policies: [
          { id: 'wait', label: 'Wait for every site; fetchers take URLs in order', detail: 'No URL is skipped. Fetchers waiting on the slow site sit idle.' },
          { id: 'retry', label: 'Re-fetch URLs that take too long', detail: 'A slow fetch is abandoned and tried again at once.' },
          { id: 'shed', label: 'Skip URLs that cannot start soon; they go back to the frontier for later', detail: 'Fetchers keep moving; skipped URLs are tried at the next visit.' },
          { id: 'breaker', label: 'Per-site timeout and pause: after repeated slow replies, stop sending fetchers to that site for a while', detail: 'The slow site is isolated; every other site keeps its full rate.' },
        ],
      },
      help: {
        hint: 'A fetcher stuck on a slow site is a fetcher that cannot serve a healthy one. How do you stop one site from holding all of them?',
        walkthrough: [
          { text: 'Normally 50 fetchers at 1 second each handle about 50 URLs a second across many sites, more than the 40 arriving.', focus: ['fetcher'] },
          { text: 'With no cap per site, many fetchers take that site’s URLs in order. Each handles one URL per 6 seconds, so capacity falls to around 8 a second.', focus: ['fetcher', 'sites'] },
          { text: 'The one-fetcher-per-site rule, a per-site timeout and a pause keep that site from tying up more than one fetcher.', focus: ['politeness', 'fetcher'] },
          { text: 'The slow site’s URLs wait in its own queue in the frontier; other sites keep their full rate.', focus: ['frontier', 'politeness'] },
        ],
        solution: [
          { type: 'list', items: ['Give every fetch a **timeout** (a few seconds), and treat repeated slowness as a signal.', 'After a few slow or failed replies, **pause that site** for a while; its URLs wait in its own queue.', 'Cap how many fetchers one site may hold at once (one, by politeness), so it can never starve the rest.', 'More fetchers help only across different sites; a single site never exceeds about one request a second.'] },
        ],
        why: 'Politeness already limits any one site to one fetcher, so a slow site can only block the fetchers it is given. A timeout and pause keep it to that.',
      },
      lessons: ['rate-limiting', 'backpressure', 'timeouts'],
    },
    {
      id: 'outage', title: 'Frontier outage', intro: 'The interviewer changes one condition. Predict, run it on your design, then revise.',
      question: 'The part that holds the frontier goes offline during the daily crawl. What keeps working, what stops, and what must you not lose?',
      change: { announce: 'New condition: the frontier goes offline for ten minutes in the middle of the daily recrawl.', rule: RULES.trace, alternate: { announce: 'New condition: the Seen-URL store is offline for ten minutes.', label: 'Replay with the Seen-URL store down' } },
      activity: {
        kind: 'trace', request: 'a URL from the frontier through a fetcher to the page store', from: ['frontier'], to: ['pages'], failCandidates: ['frontier', 'robots', 'seen', 'pages'],
        predict: { q: 'While that part is down, what happens to the crawl?', choices: [{ id: 'error', label: 'It stops or fails' }, { id: 'delayed', label: 'It carries on and catches up later' }, { id: 'ok', label: 'Nothing changes' }] },
      },
      help: {
        hint: 'What does a fetcher need before it can do anything, and where do new links go if the frontier cannot take them?',
        walkthrough: [
          { text: 'With the frontier offline, fetchers cannot learn which site to visit next, so the crawl stalls. No customer sees an error, but nothing moves.', focus: ['frontier', 'politeness', 'fetcher'] },
          { text: 'URLs already handed to fetchers can finish, and the Parser still extracts events from stored pages.', focus: ['fetcher', 'parser', 'events'] },
          { text: 'New links the Parser finds cannot be added, so it holds them and retries, or they are lost.', focus: ['parser', 'frontier'] },
          { text: 'When the frontier returns, it must still know each site’s next-allowed time, or the crawl could hit sites too soon.', focus: ['frontier', 'politeness'] },
        ],
        solution: [
          { type: 'list', items: ['Keep the frontier on **durable, replicated storage** so queues and next-allowed times survive an outage.', 'Fetchers finish what they hold; new links are **held locally and retried**, not dropped.', 'On return, resume with the same next-allowed times, so no site gets a burst.', 'If the frontier is lost entirely, rebuild from the seed list and the Seen-URL store, restarting with a polite delay for every site.'] },
        ],
        why: 'A crawl can pause without harm; what it must not do is forget which sites it visited recently, or lose the links it found.',
      },
      lessons: ['availability', 'retries', 'queues'],
    },
  ],
  rules: [
    // Design stage
    { id: 'polite', stage: 'design', when: { link: ['queue', { type: 'politeness' }] }, ack: 'Sites leave {kind:queue} only through {type:politeness}, so one place enforces the wait between visits.', strength: 'You put politeness in one place, the scheduler in front of the fetchers, so it holds whatever the fetcher count.' },
    { id: 'no-polite', stage: 'design', when: { lacks: { type: 'politeness' } }, coach: 'Many fetchers can hit one site at once. Add something that hands out a site to one fetcher at a time, only when its wait has passed.', gap: { text: 'Nothing enforced the wait between requests to one site.', fix: 'Keep a next-allowed time per site and hand each site to one fetcher at a time.', stage: 'design', lesson: 'rate-limiting' }, priority: 3 },
    { id: 'wire-crawl', stage: 'design', when: { all: [{ has: { type: 'fetcher' } }, { not: { path: [{ type: 'frontier' }, { type: 'pages' }] } }] }, coach: 'Connect the crawl path: URL frontier → Politeness scheduler → Fetcher → Page store.', priority: 2 },
    { id: 'trace-now', stage: 'design', when: { all: [{ path: [{ type: 'frontier' }, { type: 'pages' }] }, { not: { result: 'trace:crawl', is: ['ok', 'hit'] } }] }, coach: 'Press “Trace a request” to follow a URL from the frontier to a stored page.', priority: 1 },
    { id: 'crawl-ok', stage: 'design', when: { result: 'trace:crawl', is: 'ok' }, ack: 'A URL travelled from {type:frontier} to {type:pages} through your arrows.' },
    { id: 'fetch-direct', stage: 'design', when: { link: [{ type: 'frontier' }, { type: 'fetcher' }] }, priority: 9, ask: { text: '{type:frontier} hands URLs straight to {type:fetcher}. Fifty fetchers pull at once. What stops two of them hitting the same venue in the same second?', choices: [
      { id: 'scheduler', label: 'A scheduler gives each site to one fetcher at a time, after its wait', reply: 'Yes: politeness belongs where URLs are handed out. Add the Politeness scheduler between them.', verdict: 'sound' },
      { id: 'lock', label: 'Fetchers take a per-site lock before fetching', reply: 'That works too, if the lock also records when the site was last visited. A scheduler does both in one place.', verdict: 'partial' },
      { id: 'global', label: 'A global limit across all fetchers', reply: 'A global limit can still send every request to one small site. The limit has to be per site.', verdict: 'risky' },
    ] }, gap: { text: 'Fetchers could pull URLs for the same site at once.', fix: 'Put a per-site scheduler between the frontier and the fetchers.', stage: 'design', lesson: 'rate-limiting' } },
    { id: 'robots', stage: 'design', when: { link: [{ type: 'fetcher' }, { type: 'robots' }], labels: ['reads from', 'reads and writes'] }, ack: '{type:fetcher} checks {type:robots} before fetching a page.', strength: 'You made robots.txt part of every fetch, with a cache so each page does not re-download it.' },
    { id: 'no-robots', stage: 'design', when: { lacks: { type: 'robots' } }, priority: 7, ask: { text: 'Every site publishes robots.txt. How does your crawler obey it without downloading it for every page?', choices: [
      { id: 'cache', label: 'Fetch it once per site, cache it for a day, and check it before each page', reply: 'Yes: one download per site per day, and every fetch is checked against it. Add the cache from the palette.', verdict: 'sound' },
      { id: 'each', label: 'Download it before every fetch', reply: 'That doubles your requests to every site, which breaks the rate limit you are trying to keep.', verdict: 'risky' },
      { id: 'ignore', label: 'Skip it; the site will block us if it minds', reply: 'The brief requires obeying robots.txt. Ignoring it can also get us blocked from every venue.', verdict: 'risky' },
    ] }, gap: { text: 'Nothing checked robots.txt before fetching.', fix: 'Cache each site’s robots.txt and check it before every fetch.', stage: 'design', lesson: 'caching' } },
    { id: 'dedupe', stage: 'design', when: { link: [{ type: 'parser' }, { type: 'seen' }], labels: ['reads and writes', 'reads from'] }, ack: '{type:parser} checks links against {type:seen} before they join the frontier.', strength: 'New links are checked against a seen-URL store, so duplicates and traps do not multiply the work.' },
    { id: 'no-seen', stage: 'design', when: { lacks: { type: 'seen' } }, priority: 8, ask: { text: 'A calendar page links to “next month” forever, and another site serves one page under 50 URLs. What protects the crawl?', choices: [
      { id: 'seen', label: 'Normalise URLs, check them against a seen set, cap depth, and hash page contents', reply: 'Yes: normalise before comparing, cap depth per site, and skip content you have already stored. Add the Seen-URL store.', verdict: 'sound' },
      { id: 'depth', label: 'Only a depth limit', reply: 'A depth limit stops the endless calendar but not the 50 copies of one page.', verdict: 'partial' },
      { id: 'none', label: 'Nothing; sites are well behaved', reply: 'Many sites are not. One trap can fill your frontier with millions of URLs for a single venue.', verdict: 'risky' },
    ] }, gap: { text: 'No protection against duplicate URLs or crawler traps.', fix: 'Add a seen-URL store, normalise URLs, cap depth per site and hash content.', stage: 'design', lesson: 'caching' } },
    { id: 'links-back', stage: 'design', when: { link: [{ type: 'parser' }, { type: 'frontier' }] }, ack: 'New links flow back from {type:parser} into {type:frontier}.' },
    { id: 'alt-db-frontier', stage: 'design', when: { link: [{ type: 'politeness' }, 'db'], labels: ['reads and writes', 'writes to'] }, priority: 4, ask: { text: 'You keep the URL list in a database table. How do you hand out “the next URL for this site” without two fetchers taking the same one?', choices: [
      { id: 'claim', label: 'Claim the next row with a conditional update, and record the next-allowed time on the site’s row', reply: 'A valid alternative to a queue-based frontier: simpler to inspect, but every fetch is a database write and the claim must be atomic.', verdict: 'sound' },
      { id: 'read', label: 'Each fetcher reads the next URL and starts fetching', reply: 'Two fetchers can read the same row before either marks it taken, the same race as two buyers and one seat.', verdict: 'risky' },
    ] } },
    { id: 'storing', stage: 'design', when: { link: [{ type: 'fetcher' }, { type: 'pages' }], labels: ['writes to'] }, ack: '{type:fetcher} stores each page before it is parsed, so the raw page can be re-read later.' },
    { id: 'what-write', stage: 'design', when: { link: [{ type: 'parser' }, { type: 'events' }], labels: ['writes to', 'reads and writes'] }, priority: 6, ask: { text: 'A page is crawled twice, so the Parser writes the same event twice. Your arrow does not show how that is prevented. What does?', choices: [
      { id: 'key', label: 'Give each event a stable key, such as source URL plus event date, and update in place', reply: 'Yes: a repeat becomes an update instead of a duplicate row.', verdict: 'sound' },
      { id: 'dedupe-later', label: 'Remove duplicates in a nightly clean-up', reply: 'Works eventually, but readers see duplicates until the job runs. Prevent them on write.', verdict: 'partial' },
      { id: 'never', label: 'Pages are never crawled twice', reply: 'Daily recrawls and retries make a repeat certain.', verdict: 'risky' },
    ] } },
    // Per-site limits stage
    { id: 'h-unbounded', stage: 'hosts', when: { result: 'hosts', is: ['wait:unbounded', 'retry:unbounded'] }, priority: 6, ask: { text: 'The queue of URLs kept growing while one site was slow. The healthy sites’ URLs sat behind it. What isolates the slow site?', choices: [
      { id: 'breaker', label: 'A per-site timeout and pause, so a slow site can only hold the fetchers it is allowed', reply: 'Yes: the failure stays with the site that caused it. Its URLs wait in its own queue.', verdict: 'sound' },
      { id: 'more', label: 'Add many more fetchers', reply: 'More fetchers get stuck on the same slow site in the same way, and you can’t speed up a site’s server.', verdict: 'risky' },
      { id: 'skip', label: 'Skip slow URLs and move on', reply: 'That also frees fetchers, but without remembering which site is slow you will keep trying it.', verdict: 'partial' },
    ] }, gap: { text: 'One slow site held up fetchers that other sites needed.', fix: 'Time out each fetch, pause a site after repeated slow replies, and keep its URLs in its own queue.', stage: 'hosts', lesson: 'timeouts' } },
    { id: 'h-bounded', stage: 'hosts', when: { result: 'hosts', is: ['shed:bounded', 'breaker:bounded'] }, ack: 'The waiting line stayed short: healthy sites kept their rate.', strength: 'You kept one slow venue from starving every other site, using a timeout and a pause.' },
    { id: 'h-retry', stage: 'hosts', when: { result: 'hosts', is: 'retry:unbounded' }, priority: 5, coach: 'Re-fetching a slow site at once hits it again, and the site is already struggling. Try pausing the site instead.' },
    { id: 'h-more-fetchers', stage: 'hosts', when: { result: 'hosts', is: ['breaker:bounded', 'shed:bounded'] }, priority: 4, ask: { text: 'With one site paused, you have spare fetchers. Can extra fetchers make the crawl of one big venue faster?', choices: [
      { id: 'no', label: 'No: that venue is still limited to about one request a second', reply: 'Yes: per-site politeness caps the speed for one venue however many fetchers you have. More fetchers help only across sites.', verdict: 'sound' },
      { id: 'yes', label: 'Yes: put several fetchers on it', reply: 'That breaks the one-request-a-second promise, and a small venue’s server may fall over.', verdict: 'risky' },
      { id: 'later', label: 'Only if the venue’s robots.txt allows a faster rate', reply: 'Reasonable: a site can ask for slower, or in rare cases allow faster. Our default stays at one a second.', verdict: 'partial' },
    ] } },
    // Outage stage
    { id: 'o-error', stage: 'outage', when: { result: 'outage', is: 'error' }, priority: 7, ask: { text: 'With the frontier down, nothing can be fetched. What do you protect while it is offline?', choices: [
      { id: 'durable', label: 'The frontier’s queues and next-allowed times, on durable replicated storage; fetchers finish in-flight pages; parsers hold new links and retry', reply: 'Yes: the crawl can pause, but it must not forget what it knows or lose the links it just found.', verdict: 'sound' },
      { id: 'reseed', label: 'Nothing: rebuild the frontier from the seed list afterwards', reply: 'A valid fallback, but the rebuilt frontier forgets each site’s next-allowed time and in-flight work, so it can visit sites too soon and refetch pages you already have.', verdict: 'partial' },
      { id: 'drop', label: 'Drop new links found while it is down', reply: 'Those links are the crawl’s next work. Dropping them quietly shrinks the crawl without anyone noticing.', verdict: 'risky' },
    ] }, gap: { text: 'A frontier outage could lose queued work or links.', fix: 'Keep the frontier on durable, replicated storage and have parsers hold and retry new links.', stage: 'outage', lesson: 'availability' } },
    { id: 'o-delayed', stage: 'outage', when: { result: 'outage', is: 'delayed' }, ack: 'In your design the crawl waits out the outage and catches up.', strength: 'Your design lets work wait out an outage instead of failing.' },
    { id: 'o-resume', stage: 'outage', when: { result: 'outage', is: ['error', 'delayed'] }, priority: 5, ask: { text: 'The frontier is back. Eight hundred sites are due at once. What stops a burst?', choices: [
      { id: 'saved', label: 'Each site’s next-allowed time was saved, so only sites that are due are handed out', reply: 'Yes: the politeness state is part of the frontier’s durable data. The scheduler resumes at the right pace.', verdict: 'sound' },
      { id: 'ramp', label: 'Ramp up slowly after an outage and spread the due sites over several minutes', reply: 'A sensible extra guard if the state was lost, or the fleet is large. It also protects your own network.', verdict: 'partial' },
      { id: 'all', label: 'Send every due site at once to catch up', reply: 'Each site is still limited to one request a second, but your fetchers, robots cache and network may not like the burst.', verdict: 'risky' },
    ] } },
    { id: 'o-broken', stage: 'outage', when: { result: 'outage', is: 'broken' }, coach: 'There’s no chain of arrows from the frontier to the page store yet. Add the arrows, then run it again.', priority: 4 },
  ],
  solution: {
    design: g([
      ['frontier', 'frontier', 'queue', 'URL frontier', 40, 230], ['politeness', 'politeness', 'scheduler', 'Politeness scheduler', 170, 230], ['fetcher', 'fetcher', 'worker', 'Fetcher', 300, 230],
      ['robots', 'robots', 'cache', 'robots.txt cache', 300, 80], ['sites', 'sites', 'ext', 'Venue websites', 450, 80], ['pages', 'pages', 'storage', 'Page store', 450, 230],
      ['parser', 'parser', 'worker', 'Parser', 450, 370], ['seen', 'seen', 'db', 'Seen-URL store', 590, 300], ['events', 'events', 'db', 'Events store', 590, 410],
    ], [
      ['frontier', 'politeness', 'delivers to'], ['politeness', 'fetcher', 'triggers'], ['fetcher', 'robots', 'reads from'], ['fetcher', 'sites', 'calls'], ['fetcher', 'pages', 'writes to'],
      ['fetcher', 'parser', 'calls'], ['parser', 'seen', 'reads and writes'], ['parser', 'frontier', 'publishes event'], ['parser', 'events', 'writes to'],
    ]),
    why: {
      frontier: 'One queue per site with its next-allowed time. The durable record of what to crawl next.',
      politeness: 'Hands a site to one fetcher at a time, only when its wait has passed. Enforces politeness for any number of fetchers.',
      fetcher: 'Checks robots.txt, downloads the page with a timeout, and stores it.',
      robots: 'A day-old copy of each site’s rules, so every fetch is checked without a second request.',
      sites: 'Other people’s servers. Never hit more than about once a second; paused when slow.',
      pages: 'Raw pages and their content fingerprints, so a page can be re-parsed later.',
      parser: 'Extracts events and links, and drops links it has already seen.',
      seen: 'Every URL (normalised) and content hash handled, so duplicates and traps do not multiply.',
      events: 'The structured events, keyed so a recrawl updates instead of duplicating.',
    },
    alternatives: { frontier: { types: ['db'], tradeoff: 'A database table of URLs with a next-allowed time is easier to inspect and queries well, but every fetch becomes a conditional write, and the table is the hottest in the system.' } },
    trace: { title: 'A URL goes from the frontier to a stored page', steps: [
      { from: 'frontier', to: 'politeness', text: 'venue.example’s queue is due (last visit more than 1 second ago, nobody else is fetching it). Its next URL is /events/42.' },
      { from: 'politeness', to: 'fetcher', text: 'Hand venue.example to one fetcher and mark it in flight.' },
      { from: 'fetcher', to: 'robots', text: 'Cached robots.txt (4 hours old) allows /events/ with a 1-second delay.' },
      { from: 'fetcher', to: 'sites', text: 'GET /events/42 with a 5-second timeout and the crawler’s name in the User-Agent.' },
      { from: 'fetcher', to: 'pages', text: 'Store the page with its content hash.' },
      { from: 'fetcher', to: 'parser', text: 'Pass the page on. The frontier sets venue.example’s next-allowed time to one second from now.' },
      { from: 'parser', to: 'seen', text: 'Extract 12 links: 3 are new after normalising, the rest were seen.' },
      { from: 'parser', to: 'frontier', text: 'Add the 3 new URLs to venue.example’s queue; write the events to the Events store.' },
    ] },
    tradeoff: 'Per-site queues with timers make politeness exact and independent of fetcher count, but the frontier becomes a stateful, critical store that must be durable.',
    otherApproach: 'If venues can send a feed or offer an API, use that: it is cheaper, more accurate and does not load their servers. Crawl only the long tail that cannot.',
  },
};
