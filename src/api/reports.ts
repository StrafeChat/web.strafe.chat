import { api } from './client';
import type { Report, ReportReason } from './instance';

export interface CreateReportInput {
  target_type: 'user' | 'space';
  target_id: string;
  /** Where it happened, when known - lets an administrator see the context. */
  space_id?: string;
  room_id?: string;
  message_id?: string;
  reason: ReportReason;
  details?: string;
}

/**
 * File a report about a user or a space. Any signed-in account may; the server refuses a
 * second open report from the same person about the same target, and rate-limits the rest.
 */
export function createReport(input: CreateReportInput) {
  return api<Report>('/reports', { method: 'POST', json: input });
}
