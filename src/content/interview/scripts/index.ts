import type { InterviewScript } from '../types';
import { autocomplete } from './autocomplete';
import { chat } from './chat';
import { checkout } from './checkout';
import { collabEditor } from './collabEditor';
import { feed } from './feed';
import { fileSync } from './fileSync';
import { liveScores } from './liveScores';
import { lldBooking } from './lldBooking';
import { lldParkingLot } from './lldParkingLot';
import { metrics } from './metrics';
import { notifications } from './notifications';
import { payments } from './payments';
import { rateLimiter } from './rateLimiter';
import { rideMatching } from './rideMatching';
import { scheduler } from './scheduler';
import { ticketBooking } from './ticketBooking';
import { urlShortener } from './urlShortener';
import { video } from './video';

/** Authored interview scripts by case id. Every published case must have one (audit:content). */
export const SCRIPTS: Record<string, InterviewScript> = Object.fromEntries([autocomplete, chat, checkout, collabEditor, feed, fileSync, liveScores, lldBooking, lldParkingLot, metrics, notifications, payments, rateLimiter, rideMatching, scheduler, ticketBooking, urlShortener, video].map((s) => [s.caseId, s]));
