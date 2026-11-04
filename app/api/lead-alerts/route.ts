import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { minutesWaiting, reminderLevel } from '@/lib/storeLeads/rules';
import { ensureReminders, requireStoreAccess, tableMissing } from '@/lib/storeLeads/server';

export const dynamic = 'force-dynamic';

/**
 * What needs the signed-in store's attention right now: its unread reminders (20 and 40 minutes) for leads that
 * still have no response, and how many leads are waiting. Polled by the app on every page while a store is signed in.
 * All timings come from each lead's assignment time on the server, so a refresh or a closed tab changes nothing.
 */
export async function GET(request: NextRequest) {
  const guard = await requireStoreAccess(request);
  if (!guard.ok) return guard.response;
  if (guard.isAdmin || !guard.posCode) return NextResponse.json({ serverNow: new Date().toISOString(), alerts: [], pending: { total: 0, over20: 0, over40: 0 } });
  try {
    await ensureReminders().catch(() => 0);
    const now = new Date();
    const waiting = await prisma.storeLead.findMany({
      where: { posCode: { equals: guard.posCode, mode: 'insensitive' }, firstResponseAt: null, conversion: null },
      select: { id: true, customerName: true, requirement: true, assignedAt: true, firstResponseAt: true, conversion: true },
      orderBy: { assignedAt: 'asc' },
    });
    const unread = await prisma.leadNotification.findMany({
      where: { posCode: { equals: guard.posCode, mode: 'insensitive' }, readAt: null, storeLeadId: { in: waiting.map((w) => w.id) } },
      select: { id: true, storeLeadId: true, kind: true, dueAt: true },
    });
    const byLead = new Map<string, typeof unread>();
    for (const n of unread) byLead.set(n.storeLeadId, [...(byLead.get(n.storeLeadId) ?? []), n]);
    // One alert per lead, showing the most urgent unread reminder; reading it marks every unread reminder of that lead.
    const alerts = waiting.flatMap((w) => {
      const list = byLead.get(w.id);
      if (!list?.length) return [];
      const top = list.find((n) => n.kind === 'REMINDER_40') ?? list[0];
      return [{ id: top.id, ids: list.map((n) => n.id), leadId: w.id, level: top.kind === 'REMINDER_40' ? 2 : 1, customerName: w.customerName, requirement: w.requirement, assignedAt: w.assignedAt.toISOString(), dueAt: top.dueAt.toISOString(), minutesWaiting: minutesWaiting(w.assignedAt, now) }];
    });
    return NextResponse.json({
      serverNow: now.toISOString(),
      alerts,
      pending: { total: waiting.length, over20: waiting.filter((w) => reminderLevel(w, now) >= 1).length, over40: waiting.filter((w) => reminderLevel(w, now) >= 2).length },
    });
  } catch (error) {
    // Until the tables exist, say "nothing to report" rather than breaking every page.
    if (tableMissing(error)) return NextResponse.json({ serverNow: new Date().toISOString(), alerts: [], pending: { total: 0, over20: 0, over40: 0 }, tableMissing: true });
    console.error('GET /api/lead-alerts error:', (error as Error)?.message);
    return NextResponse.json({ error: 'Alerts could not be loaded.' }, { status: 500 });
  }
}
