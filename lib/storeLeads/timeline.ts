/** The history of one lead, as one list in time order: assignment, every follow-up, status changes, and the automatic reminders. */

import { prisma } from '@/lib/prisma';
import { CONVERSION_LABEL, INTEREST_LABEL, VISIT_LABEL, type Conversion, type Interest, type Visit } from './rules';

export interface TimelineEvent {
  at: string;
  kind: 'ASSIGNED' | 'FOLLOW_UP' | 'CLOSED' | 'REMINDER_20' | 'REMINDER_40';
  by: string | null;
  note: string | null;
  /** Short text such as "Interest: Hot · Visit: today". */
  changes: string | null;
  /** For reminders: when it fell due, and whether and when the store acknowledged it. */
  dueAt?: string;
  readAt?: string | null;
}

export async function timelineOf(storeLeadId: string, audience: 'store' | 'admin'): Promise<TimelineEvent[]> {
  const [acts, notes] = await Promise.all([
    prisma.leadActivity.findMany({ where: { storeLeadId }, orderBy: { at: 'asc' } }),
    prisma.leadNotification.findMany({ where: { storeLeadId }, orderBy: { dueAt: 'asc' } }),
  ]);
  const events: TimelineEvent[] = [];
  for (const a of acts) {
    const parts: string[] = [];
    if (a.interest) parts.push(`Interest: ${INTEREST_LABEL[a.interest as Interest] ?? a.interest}`);
    if (a.visitIntention) parts.push(VISIT_LABEL[a.visitIntention as Visit] ?? a.visitIntention);
    if (a.conversion) parts.push(`Status: ${CONVERSION_LABEL[a.conversion as Conversion] ?? a.conversion}`);
    events.push({
      at: a.at.toISOString(),
      kind: (a.kind as TimelineEvent['kind']) ?? 'FOLLOW_UP',
      // A store does not see who on the sales side shared the lead.
      by: audience === 'store' && a.kind === 'ASSIGNED' ? null : a.byName,
      note: a.note,
      changes: parts.length ? parts.join(' · ') : null,
    });
  }
  for (const n of notes) {
    events.push({ at: n.createdAt.toISOString(), kind: n.kind as TimelineEvent['kind'], by: null, note: null, changes: null, dueAt: n.dueAt.toISOString(), readAt: n.readAt?.toISOString() ?? null });
  }
  return events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
