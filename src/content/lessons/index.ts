import type { GenericLesson } from '../lessonTypes';
import { START_LESSONS } from './start';
import { BRIDGE_LESSONS } from './bridges';
import { FOUNDATIONS1 } from './foundations1';
import { FOUNDATIONS2 } from './foundations2';
import { DATA1 } from './data1';
import { DATA2 } from './data2';

const all: GenericLesson[] = [...START_LESSONS, ...BRIDGE_LESSONS, ...FOUNDATIONS1, ...FOUNDATIONS2, ...DATA1, ...DATA2];

export const GENERIC_LESSONS: Record<string, GenericLesson> = Object.fromEntries(all.map((l) => [l.id, l]));
