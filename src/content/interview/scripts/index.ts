import type { InterviewScript } from '../types';
import { ticketBooking } from './ticketBooking';
import { lldBooking } from './lldBooking';

/** Authored interview scripts by case id. Every published case must have one (audit:content). */
export const SCRIPTS: Record<string, InterviewScript> = Object.fromEntries([ticketBooking, lldBooking].map((s) => [s.caseId, s]));
