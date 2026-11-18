import type { GenericLesson } from '../lessonTypes';
import { START_LESSONS } from './start';
import { BRIDGE_LESSONS } from './bridges';

const all: GenericLesson[] = [...START_LESSONS, ...BRIDGE_LESSONS];

export const GENERIC_LESSONS: Record<string, GenericLesson> = Object.fromEntries(all.map((l) => [l.id, l]));
