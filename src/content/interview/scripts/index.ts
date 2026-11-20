import type { InterviewScript } from '../types';
import { fileSync } from './fileSync';
import { liveScores } from './liveScores';
import { lldBooking } from './lldBooking';
import { notifications } from './notifications';
import { rateLimiter } from './rateLimiter';
import { ticketBooking } from './ticketBooking';
import { urlShortener } from './urlShortener';
import { video } from './video';

/** Authored interview scripts by case id. Every published case must have one (audit:content). */
export const SCRIPTS: Record<string, InterviewScript> = Object.fromEntries([fileSync, liveScores, lldBooking, notifications, rateLimiter, ticketBooking, urlShortener, video].map((s) => [s.caseId, s]));
