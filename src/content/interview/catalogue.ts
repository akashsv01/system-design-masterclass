/** Generic parts (searchable beyond each case's small picker) and arrow meanings by the kinds they connect. */
import type { CompKind } from '../../sim/interview/graph';
import type { PaletteItem } from './types';

export const CATALOGUE: PaletteItem[] = [
  { type: 'client', kind: 'client', name: 'Client app', blurb: 'The phone or web app a person taps. It sends requests and shows the replies.' },
  { type: 'app', kind: 'service', name: 'App server', blurb: 'Runs your code: checks the request, applies the rules, talks to storage.' },
  { type: 'db', kind: 'db', name: 'Database', blurb: 'Keeps records durably. Usually the source of truth.' },
  { type: 'cache', kind: 'cache', name: 'Cache', blurb: 'A fast copy of data that is read often. It can be out of date.' },
  { type: 'queue', kind: 'queue', name: 'Message queue', blurb: 'Holds work until a worker takes it, so the sender doesn’t wait.' },
  { type: 'worker', kind: 'worker', name: 'Worker', blurb: 'Takes jobs from a queue and does them in the background.' },
  { type: 'lb', kind: 'lb', name: 'Load balancer', blurb: 'Spreads incoming requests across several servers.' },
  { type: 'gateway', kind: 'gateway', name: 'API gateway', blurb: 'One front door: checks who is calling, limits rates, routes requests.' },
  { type: 'stream', kind: 'stream', name: 'Event log', blurb: 'An ordered, replayable list of events that many consumers can read.' },
  { type: 'storage', kind: 'storage', name: 'Object storage', blurb: 'Stores files and large blobs (images, video, backups) cheaply.' },
  { type: 'cdn', kind: 'cdn', name: 'CDN', blurb: 'Copies of content on servers close to users, so reads travel less far.' },
  { type: 'ext', kind: 'ext', name: 'External service', blurb: 'Someone else’s system you call, such as a payment provider. You don’t control it.' },
  { type: 'search', kind: 'search', name: 'Search index', blurb: 'Finds records by words or fields that aren’t the main key.' },
  { type: 'scheduler', kind: 'scheduler', name: 'Scheduler', blurb: 'Starts work at a set time or after a delay.' },
  { type: 'replica', kind: 'db', name: 'Read replica', blurb: 'A copy of a database that serves reads. It lags the leader slightly.' },
];

export const LLD_CATALOGUE: PaletteItem[] = [
  { type: 'class', kind: 'class', name: 'Class', blurb: 'An object type that holds data and the rules for changing it.' },
  { type: 'enum', kind: 'enum', name: 'Enum', blurb: 'A fixed set of named values, such as sizes or states.' },
  { type: 'iface', kind: 'iface', name: 'Interface', blurb: 'A promise of methods that several classes can keep in their own way.' },
];

export function verbsFor(from: CompKind, to: CompKind): string[] {
  if (from === 'state' || to === 'state') return [];
  const lld = (k: CompKind) => k === 'class' || k === 'enum' || k === 'iface';
  if (lld(from) || lld(to)) return to === 'iface' ? ['implements', 'uses'] : ['has', 'has many', 'uses', 'creates', 'notifies'];
  if (from === 'client') return ['sends request'];
  if (to === 'db' || to === 'storage' || to === 'search') return from === 'db' ? ['replicates to'] : ['reads from', 'writes to', 'reads and writes'];
  if (to === 'cache') return ['reads from', 'writes to', 'invalidates'];
  if (to === 'queue' || to === 'stream') return ['publishes event'];
  if (from === 'queue' || from === 'stream') return ['delivers to'];
  if (to === 'ext') return ['calls'];
  if (from === 'ext') return ['sends callback'];
  if (from === 'scheduler') return ['triggers'];
  return ['sends request', 'calls'];
}

export const KIND_NAME: Record<CompKind, string> = {
  client: 'client', lb: 'load balancer', gateway: 'gateway', service: 'service', worker: 'worker', db: 'database', cache: 'cache', queue: 'queue',
  stream: 'event log', storage: 'object storage', cdn: 'CDN', ext: 'external service', search: 'search index', scheduler: 'scheduler',
  class: 'class', enum: 'enum', iface: 'interface', state: 'state',
};
