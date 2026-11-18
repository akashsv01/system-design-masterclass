import type { GenericLesson } from '../lessonTypes';

const all: GenericLesson[] = [];

export const GENERIC_LESSONS: Record<string, GenericLesson> = Object.fromEntries(all.map((l) => [l.id, l]));
