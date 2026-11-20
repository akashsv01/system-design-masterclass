import type { InterviewScript } from '../types';
import { checkout } from './checkout';
import { collabEditor } from './collabEditor';
import { fileSync } from './fileSync';
import { liveScores } from './liveScores';
import { lldBooking } from './lldBooking';
import { notifications } from './notifications';
import { payments } from './payments';
import { rateLimiter } from './rateLimiter';
import { rideMatching } from './rideMatching';
import { ticketBooking } from './ticketBooking';
import { urlShortener } from './urlShortener';
import { video } from './video';

/** Authored interview scripts by case id. Every published case must have one (audit:content). */
export const SCRIPTS: Record<string, InterviewScript> = Object.fromEntries([checkout, collabEditor, fileSync, liveScores, lldBooking, notifications, payments, rateLimiter, rideMatching, ticketBooking, urlShortener, video].map((s) => [s.caseId, s]));
