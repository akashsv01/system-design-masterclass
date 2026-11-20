import type { InterviewScript } from '../types';
import { RULES } from '../../../sim/interview/sims';
import { py } from '../../lessons/_kit';

const st = (states: [string, string, number, number][], trans: [string, string, string][]) => ({
  comps: states.map(([id, label, x, y]) => ({ id, type: id, kind: 'state' as const, label, x, y })),
  links: trans.map(([from, to, label]) => ({ id: `${from}-${to}-${label}`, from, to, label })),
});

export const lldBoardGame: InterviewScript = {
  caseId: 'lld-board-game',
  track: 'lld',
  doLine: 'Design a two-player board game: draw a game’s states, give each job to one object, then handle two players submitting a move for the same turn',
  skills: ['state-machines', 'object-design', 'concurrency'],
  brief: {
    interviewer: { name: 'Tomas', role: 'game developer who owns the board-game engine' },
    intro: 'We are building tic-tac-toe, and the next game on the roadmap is Connect Four. I want an engine where the second game is a configuration, not a rewrite.',
    users: 'Two players on separate phones, and the game code that receives their moves.',
    needs: ['Start a game when the second player joins', 'Take turns placing pieces', 'Detect a win or a full board', 'Let a player resign'],
    mustHold: ['Players alternate: nobody moves twice in a row', 'A move on a taken cell, a full column or a finished game is refused', 'A game has exactly one outcome: won (including by resignation) or drawn'],
    constraints: ['Tic-tac-toe is 3×3, three in a row; Connect Four is 6×7, four in a row, pieces fall to the lowest free row', 'Two players per game, moves arrive from two phones', 'Moves are checked on the server, not trusted from the phone'],
    outOfScope: ['Matchmaking and ratings', 'A computer opponent', 'Drawing the board'],
    terms: [
      { term: 'state machine', meaning: 'a list of states and the events allowed to move between them' },
      { term: 'invariant', meaning: 'a rule that must be true before and after every method call' },
      { term: 'gravity', meaning: 'in Connect Four, a piece falls to the lowest empty row of the column chosen' },
    ],
    firstMove: 'A game starts waiting for a second player, then is being played, then ends. Draw its states and the events between them, then run the clock through Ana winning and Ben trying to play on.',
  },
  palette: [
    { type: 'game', kind: 'class', name: 'Game', blurb: 'One match: whose turn it is, its state, and play(player, move).' },
    { type: 'board', kind: 'class', name: 'Board', blurb: 'The grid: places a piece, and says whether the last piece wins.' },
    { type: 'player', kind: 'class', name: 'Player', blurb: 'A name and a mark, such as X or O.' },
    { type: 'rules', kind: 'class', name: 'Rules', blurb: 'Rows, columns, win length and whether pieces fall. The only thing that differs between games.' },
    { type: 'game-state', kind: 'enum', name: 'GameState', blurb: 'The fixed set of states a game can be in.' },
  ],
  verbs: ['has', 'has many', 'uses', 'creates'],
  stages: [
    {
      id: 'clarify', title: 'Clarify', intro: 'Find what is the same in both games and what varies.',
      question: 'Which rules would you confirm before deciding what is a class and what is a setting?',
      activity: { kind: 'clarify', questions: [
        { id: 'vary', q: 'What differs between tic-tac-toe and Connect Four?', a: 'Board size, how many in a row win, and gravity. Turn order, move checking and the game’s life cycle are the same.' },
        { id: 'draw', q: 'When is a game drawn?', a: 'When the board is full and nobody has a winning line.' },
        { id: 'resign', q: 'Can a player resign?', a: 'Yes, at any time while the game is being played. The other player wins.' },
        { id: 'illegal', q: 'What happens on an illegal move?', a: 'It is refused with a reason (cell taken, column full, not your turn, game over). The turn does not pass.' },
        { id: 'concurrent', q: 'Can both players submit a move at the same moment?', a: 'Yes, and one player can also send two moves at once, such as a double tap. Only the player whose turn it is may move, and only once.' },
      ], assumptions: [
        { id: 'first', q: 'Who moves first?', options: [
          { id: 'creator', label: 'The player who created the game', consequence: 'Simple and predictable. The second player always moves second.' },
          { id: 'random', label: 'Chosen at random when the second player joins', consequence: 'Fairer over many games, but tests need a way to fix the choice.' },
        ] },
      ] },
      help: {
        hint: 'Which parts of the two games are identical?',
        walkthrough: [
          { text: 'Both games: two players, alternate turns, refuse illegal moves.' },
          { text: 'Both have a life cycle: waiting, playing, then won or drawn.' },
          { text: 'Only size, win length and gravity differ, so they can be settings.' },
        ],
        solution: [{ type: 'list', items: ['Same: turn order, move refusal, life cycle.', 'Different: grid size, win length, gravity.', 'Illegal moves do not pass the turn.', 'Only the player whose turn it is may move.'] }],
        why: 'Seeing that the difference is three numbers and one flag is what lets the second game be configuration.',
      },
      lessons: ['contracts-invariants', 'polymorphism-composition'],
    },
    {
      id: 'states', title: 'A game’s states', intro: 'Place the states, connect them, name each arrow with the event, then run the clock.',
      question: 'Draw the game’s states and events. What happens when Ben tries to play after Ana has won?',
      activity: {
        kind: 'states', entity: 'The game', initial: 'waiting',
        states: [
          { key: 'waiting', label: 'Waiting', blurb: 'One player is in; the game needs a second.' },
          { key: 'playing', label: 'Playing', blurb: 'Two players; the one whose turn it is may move.' },
          { key: 'won', label: 'Won', blurb: 'One player has a winning line or the other resigned. Final.' },
          { key: 'draw', label: 'Draw', blurb: 'The board is full with no winner. Final.' },
        ],
        events: [{ id: 'join', label: 'join' }, { id: 'move', label: 'move' }, { id: 'win', label: 'win (winning move)' }, { id: 'full', label: 'board full' }, { id: 'resign', label: 'resign' }],
        scenario: [
          { at: 0, event: 'join', label: 'Minute 0: Ben joins Ana’s game', expect: 'playing' },
          { at: 4, event: 'win', label: 'Minute 4: Ana places a third X in a row', expect: 'won' },
          { at: 5, event: 'move', label: 'Minute 5: Ben tries to place a piece after the game ended' },
          { at: 6, event: 'resign', label: 'Minute 6: Ben tries to resign from a finished game' },
        ],
        starter: st([['waiting', 'Waiting', 70, 200], ['playing', 'Playing', 270, 200]], [['waiting', 'playing', 'join']]),
      },
      help: {
        hint: 'Ana’s winning move ended the game. Which arrow leaves Playing, and does any arrow leave Won?',
        walkthrough: [
          { text: 'Minute 0: Waiting → Playing on “join”.' },
          { text: 'Minute 4: Playing → Won on “win”. Ordinary moves keep the game in Playing; only the winning one changes the state.' },
          { text: 'Minutes 5 and 6: Won has no outgoing arrows, so the move and the resignation are refused and the state stays Won.' },
          { text: 'Playing → Draw on “board full”, and Playing → Won on “resign”, complete the machine.' },
        ],
        solution: [
          { type: 'table', head: ['From', 'Event', 'To'], rows: [['Waiting', 'join', 'Playing'], ['Playing', 'move (legal)', 'Playing'], ['Playing', 'win', 'Won'], ['Playing', 'board full', 'Draw'], ['Playing', 'resign', 'Won (the other player)']] },
          { type: 'p', text: 'Won and Draw have no arrows out. “Illegal moves are refused” is not an extra rule: it is what a missing arrow means.' },
        ],
        why: 'The brief says a finished game refuses further moves. That is true in your design only because no arrow leaves the final states.',
      },
      lessons: ['state-machines', 'pattern-state'],
    },
    {
      id: 'roles', title: 'Who does what', intro: 'Give each job to one object, then walk through a winning move.',
      question: 'Which object owns each job, and which one detects the win?',
      activity: {
        kind: 'roles',
        classes: [
          { id: 'game', name: 'Game', blurb: 'State, whose turn, play().' },
          { id: 'board', name: 'Board', blurb: 'Grid, place(), wins().' },
          { id: 'player', name: 'Player', blurb: 'name, mark' },
          { id: 'rules', name: 'Rules', blurb: 'rows, cols, win length, gravity' },
        ],
        cards: [
          { id: 'turn', text: 'Decide whose turn it is and refuse a move from the other player', owner: 'game', why: 'Turns belong to the match, not to the grid.' },
          { id: 'free', text: 'Check the cell is empty (or the column is not full) and place the piece', owner: 'board', why: 'Only the board knows what is on it.' },
          { id: 'win', text: 'Check whether the last piece completes a winning line', owner: 'board', alt: ['rules'], why: 'The board has the pieces; the Rules supply how many in a row. Checking inside Board with the win length from Rules is the usual split.' },
          { id: 'over', text: 'Refuse any move once the game is won or drawn', owner: 'game', why: 'The game’s state decides whether moves are accepted.' },
          { id: 'mark', text: 'Remember a player’s name and mark (X or O)', owner: 'player', why: 'That is all a Player is.' },
          { id: 'vary', text: 'Say how many in a row win and whether pieces fall', owner: 'rules', alt: ['board'], why: 'Keeping these settings together is what makes Connect Four a new configuration, not a new class.' },
        ],
        walk: { title: 'Ana places the third X: a winning move', steps: [
          { prompt: 'Who receives “Ana plays row 0, column 2” and checks it is Ana’s turn and the game is still being played?', owner: 'game', call: 'game.play(player="ana", row=0, col=2)' },
          { prompt: 'Who places the piece and finds where it lands?', owner: 'board', call: 'board.place("X", col=2, row=0)' },
          { prompt: 'Who knows how many in a row are needed?', owner: 'rules', call: 'rules.win_length  # 3' },
          { prompt: 'Who checks that the piece completes a line?', owner: 'board', call: 'board.wins(row, col)' },
          { prompt: 'Who moves the game from Playing to Won?', owner: 'game', call: 'self.state = GameState.WON' },
        ] },
      },
      help: {
        hint: 'Which object would change if you added a third game with a 5×5 grid?',
        walkthrough: [
          { text: 'Game: turns, state, refusals once finished.', focus: ['game', 'gstate'] },
          { text: 'Board: place a piece and test the line, using the win length.', focus: ['board'] },
          { text: 'Rules: the numbers and the gravity flag; a new game is a new Rules.', focus: ['rules'] },
        ],
        solution: [
          { type: 'code', lang: 'python', code: py('sdm/cases/board_game.py', 'tic_tac_toe'), caption: 'python/sdm/cases/board_game.py — tic-tac-toe is just a Board configured with 3×3, three in a row' },
          { type: 'p', text: 'Connect Four is `Board(6, 7, 4, gravity=True)`. Game does not change.' },
        ],
        why: 'The pieces that never vary (turns, state, refusals) are separated from the settings that do, so a new game costs no new logic.',
      },
      lessons: ['responsibilities', 'polymorphism-composition', 'solid'],
    },
    {
      id: 'same-turn', title: 'Same turn', intro: 'The interviewer changes one condition. Predict, run it, revise.',
      question: 'It is Ana’s turn. Her phone sends two moves for different cells at the same moment, from a double tap. Can both be accepted?',
      change: { announce: 'New condition: Ana taps twice and her phone sends two moves within a few milliseconds. The server handles them on two threads.', rule: RULES.timeline, alternate: { announce: 'Second twist: Ana’s phone loses signal after sending, and retries the same move three seconds later.', label: 'A retried move' } },
      activity: {
        kind: 'timeline', names: ['Ana (first tap)', 'Ana (second tap)'], resource: 'Moves allowed this turn', initial: 1,
        read: 'checks whose turn it is', write: 'places the piece and passes the turn',
        start: [{ actor: 0, kind: 'read' }, { actor: 1, kind: 'read' }, { actor: 0, kind: 'write' }, { actor: 1, kind: 'write' }],
        guards: [
          { id: 'plain', label: 'Check the turn, then place the piece', detail: 'Both requests read “it is Ana’s turn” before either has passed the turn, so both are accepted.', code: 'if self.turn == player:\n    self.board.place(...)\n    self.turn = other' },
          { id: 'conditional', label: 'Conditional write with a move number', detail: 'Each move says “I am move 12”. The store accepts only if the game is still at move 11, so the second request finds 12 already taken.', code: 'UPDATE games SET move_no = 12 ... WHERE id = :g AND move_no = 11' },
          { id: 'lock', label: 'Lock the game while a move is processed', detail: 'The second request waits, then sees it is no longer its turn.', code: 'with game.lock:\n    ...  # check turn, place, pass turn' },
        ],
        predict: { q: 'With check-then-place, how many of the two moves are accepted?', choices: [{ id: 'one', label: 'One' }, { id: 'both', label: 'Both' }, { id: 'none', label: 'Neither' }] },
      },
      help: {
        hint: 'Is “is it my turn” still true by the time the piece is placed?',
        walkthrough: [
          { text: 'Each thread checks the turn at the same moment, and in each check the answer is “yes, for this turn”.' },
          { text: 'Both place a piece, so Ana has moved twice in a row and the turn order is broken.' },
          { text: 'Check and place must be one step: a lock on the game, or a conditional write that names the move number it expects.' },
        ],
        solution: [{ type: 'p', text: 'Not safely. Make the turn check and the placement one atomic step: a lock inside one server, or a move number in the shared store so only the move that matches the current count is accepted. A move number also makes a retried move harmless: it is refused as already played.' }],
        why: '“Players alternate” must hold even when moves overlap, so the check has to be part of the change, not before it.',
      },
      lessons: ['concurrency-lld', 'concurrent-reservations'],
    },
  ],
  rules: [
    { id: 'states-coach', stage: 'states', when: { not: { result: 'states', is: ['pass', 'stuck', 'fail'] } }, coach: 'Add Won, then draw an arrow from Playing to Won named “win”.' },
    { id: 'states-ok', stage: 'states', when: { result: 'states', is: 'pass' }, ack: 'Your machine moved from Waiting to Playing to Won on the right events.', strength: 'Your game state machine ends in a final state with no way out, so finished games refuse further moves.' },
    { id: 'states-stuck', stage: 'states', when: { result: 'states', is: 'stuck' }, priority: 6, ask: { text: 'An event the brief allows was refused, so some state you need has no arrow. Which one is the game missing?', choices: [
      { id: 'join', label: 'Waiting → Playing on “join”, and Playing → Won on “win”', reply: 'Yes. Add the missing arrow and run the clock again.', verdict: 'sound' },
      { id: 'reset', label: 'Allow every event from every state', reply: 'That removes the refusals the brief asks for: Ben could then place a piece on a won game.', verdict: 'risky' },
    ] }, gap: { text: 'Part of the game’s life cycle has no arrow, so a legal event was refused.', fix: 'Add Waiting → Playing on “join” and Playing → Won on “win”.', stage: 'states', lesson: 'state-machines' } },
    { id: 'states-after-over', stage: 'states', when: { result: 'states', is: 'pass' }, priority: 5, ask: { text: 'Ben’s move after the win was refused because Won has no arrows out. Could Ben’s phone still show the board as playable?', choices: [
      { id: 'refresh', label: 'Yes, until it learns of the win; the server refuses and the app should refresh the state', reply: 'Right. The diagram shows the server’s rule, not what each phone currently believes.', verdict: 'sound' },
      { id: 'no', label: 'No, the state machine prevents it', reply: 'The machine protects the server. A phone can still show stale state until it is told.', verdict: 'partial' },
    ] } },
    { id: 'states-resign', stage: 'states', when: { link: ['state', 'state'], labels: ['resign'] }, ack: 'You added resign as an arrow from Playing, so a player can leave without a win.', strength: 'You handled resignation as its own transition rather than a special case in move code.' },
    { id: 'roles-coach', stage: 'roles', when: { not: { result: 'roles', is: ['pass', 'gaps'] } }, coach: 'Start with the numbers that differ between the two games. Which object holds them?' },
    { id: 'roles-good', stage: 'roles', when: { result: 'roles', is: 'pass' }, ack: 'Turns and state sit in Game, the grid in Board, and the varying numbers in Rules.', strength: 'You kept what varies (grid size, win length, gravity) apart from what does not (turns and state).' },
    { id: 'roles-gap', stage: 'roles', when: { result: 'roles', is: 'gaps' }, gap: { text: 'Some jobs were given to objects that do not own the data they need.', fix: 'Reassign the cards marked “reconsider” and walk through the winning move again.', stage: 'roles', lesson: 'responsibilities' } },
    { id: 'roles-alt', stage: 'roles', when: { result: 'roles', is: 'pass' }, priority: 4, ask: { text: 'Connect Four could also be a subclass of a TicTacToe class, or a second Game class. Why prefer one Board with Rules?', choices: [
      { id: 'config', label: 'The games differ by three values, so a setting changes them; a new class would copy turn logic', reply: 'Yes. Inheritance pays off when behaviour differs, not when numbers do.', verdict: 'sound' },
      { id: 'sub', label: 'Subclasses are better; each game has its own class', reply: 'Valid when games differ in logic, for example chess. Here they differ in numbers, so subclasses repeat the same code twice.', verdict: 'partial' },
    ] } },
    { id: 'rules-missing', when: { all: [{ has: { type: 'board' } }, { lacks: { type: 'rules' } }] }, ask: { text: 'Your Board has no Rules next to it. Where do the win length and gravity live?', choices: [
      { id: 'ctor', label: 'As constructor values on Board itself', reply: 'Fine for two games, and it is what the tested code does. A Rules object helps when settings grow.', verdict: 'sound' },
      { id: 'hard', label: 'Hard-coded inside the win check', reply: 'Then Connect Four means editing the win check, and tic-tac-toe could break.', verdict: 'risky' },
    ] } },
    { id: 'same-fixed', stage: 'same-turn', when: { result: 'same-turn', is: 'one' }, ack: 'Only one of the two moves was accepted for that turn.', strength: 'You made the turn check and the placement one step, so players cannot move twice in a row.' },
    { id: 'same-over', stage: 'same-turn', when: { result: 'same-turn', is: 'oversold' }, priority: 5, ask: { text: 'Both moves were accepted for one turn. How should the server decide which one wins?', choices: [
      { id: 'moveno', label: 'Each move carries a move number; the store accepts it only if the game is still at the previous one', reply: 'Yes. It decides without a clock, and a retried move is refused because its number is taken.', verdict: 'sound' },
      { id: 'lock', label: 'Lock the game while a move is processed', reply: 'Good inside one server. If a game can be served by several servers, the lock must be shared too.', verdict: 'partial' },
      { id: 'first', label: 'Whichever request arrived first by timestamp', reply: 'Phone clocks disagree and network delay reorders arrival. A move number in the store avoids relying on time.', verdict: 'risky' },
    ] }, gap: { text: 'Two moves for the same turn were both accepted.', fix: 'Make the turn check and the placement one step: a lock or a move-number conditional write.', stage: 'same-turn', lesson: 'concurrency-lld' } },
    { id: 'same-retry', stage: 'same-turn', when: { result: 'same-turn', is: 'one' }, priority: 3, ask: { text: 'Ana’s retried move arrives after her first one was accepted. The timeline cannot show it. What should the server reply?', choices: [
      { id: 'already', label: 'That move is already played, with the current board', reply: 'Yes. It is a success from Ana’s point of view; she needs the current board, not an error.', verdict: 'sound' },
      { id: 'place', label: 'Try to place it again', reply: 'It would land on a used cell or on the wrong turn. A move number lets the server recognise the repeat.', verdict: 'risky' },
    ] } },
  ],
  solution: {
    design: {
      comps: [
        { id: 'game', type: 'game', kind: 'class', label: 'Game', x: 70, y: 200 },
        { id: 'gstate', type: 'game-state', kind: 'enum', label: 'GameState', x: 70, y: 380 },
        { id: 'player', type: 'player', kind: 'class', label: 'Player', x: 280, y: 60 },
        { id: 'board', type: 'board', kind: 'class', label: 'Board', x: 300, y: 220 },
        { id: 'rules', type: 'rules', kind: 'class', label: 'Rules', x: 520, y: 220 },
      ],
      links: [
        { id: 'g-p', from: 'game', to: 'player', label: 'has many' },
        { id: 'g-b', from: 'game', to: 'board', label: 'has' },
        { id: 'g-s', from: 'game', to: 'gstate', label: 'uses' },
        { id: 'b-r', from: 'board', to: 'rules', label: 'uses' },
      ],
    },
    why: {
      game: 'Owns the life cycle and whose turn it is. play() refuses a move out of turn or after the game ends, and keeps check-and-place together.',
      gstate: 'Waiting, Playing, Won, Draw: the only states a game can be in.',
      player: 'Name and mark. Exactly two per game.',
      board: 'The grid. place() refuses a taken cell or full column; wins() looks along four directions from the last piece.',
      rules: 'Rows, columns, win length, gravity. Tic-tac-toe and Connect Four are two values of this.',
    },
    alternatives: {
      rules: { types: ['iface'], tradeoff: 'A common interface with a class per game fits games whose logic differs, such as chess. For two grid games it adds classes without removing any code.' },
    },
    trace: { title: 'Ana plays the winning third X', steps: [
      { from: 'game', to: 'gstate', text: 'Checks the state is Playing and it is Ana’s turn; otherwise refuses.' },
      { from: 'game', to: 'board', text: 'board.place("X", ...) puts the piece on a free cell.' },
      { from: 'board', to: 'rules', text: 'wins() asks the rules for the win length: 3.' },
      { from: 'board', to: 'game', text: 'Three in a row found, so the game sets its state to Won with Ana as winner.' },
    ] },
    tradeoff: 'One configurable Board plus a state machine means a new grid game is a new Rules value, but a game with different move logic would not fit.',
    otherApproach: 'For games whose moves differ in kind (chess, checkers), use an interface for pieces or moves with a class per game; for two grid games, configuration is smaller and easier to test.',
  },
};
