import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { statusOf, summarise, minutesWaiting, reminderLevel } from '@/lib/storeLeads/rules';
import { ensureReminders, MAX_ROWS, MISSING_MSG, rangeFrom, requireStoreAccess, serializeLead, tableMissing, withLast } from '@/lib/storeLeads/server';

export const dynamic = 'force-dynamic';

/**
 * Received Leads for the signed-in store: the leads assigned to its own POS code in the chosen period, PLUS every lead that is
 * still waiting for a first response (from any date), so nothing unanswered can be hidden by a date filter.
 * An admin passes ?posCode= to look at one store. The sales user who shared a lead is not included for a store.
 */
export async function GET(request: NextRequest) {
  const guard = await requireStoreAccess(request);
  if (!guard.ok) return guard.response;
  const sp = request.nextUrl.searchParams;
  const posCode = guard.posCode ?? sp.get('posCode')?.trim();
  if (!posCode) return NextResponse.json({ error: 'Choose a store (posCode).' }, { status: 400 });
  const range = rangeFrom(sp);
  if (!range) return NextResponse.json({ error: 'Use date=YYYY-MM-DD or month=YYYY-MM' }, { status: 400 });

  try {
    await ensureReminders().catch(() => 0);
    const now = new Date();
    const storeRow = await prisma.store.findFirst({ where: { posCode: { equals: posCode, mode: 'insensitive' } }, select: { posCode: true, storeName: true, city: true } });
    const store = { posCode: { equals: posCode, mode: 'insensitive' as const } };
    const rows = await prisma.storeLead.findMany({
      where: { ...store, OR: [{ assignedAt: { gte: range.start, lt: range.end } }, { firstResponseAt: null, conversion: null }] },
      include: withLast,
      orderBy: { assignedAt: 'desc' },
      take: MAX_ROWS + 1,
    });
    const truncated = rows.length > MAX_ROWS;
    const all = truncated ? rows.slice(0, MAX_ROWS) : rows;
    const inRange = all.filter((l) => l.assignedAt >= range.start && l.assignedAt < range.end);
    const waiting = all.filter((l) => !l.firstResponseAt && !l.conversion);
    const status = sp.get('status');
    const leads = status ? all.filter((l) => statusOf(l) === status || (status === 'OVERDUE' && serializeLead(l, now, 'store').overdueFollowUp)) : all;
    return NextResponse.json({
      serverNow: now.toISOString(),
      range: range.label,
      posCode,
      store: storeRow,
      total: leads.length,
      truncated,
      summary: summarise(inRange, now),
      pending: { total: waiting.length, over20: waiting.filter((l) => reminderLevel(l, now) >= 1).length, over40: waiting.filter((l) => reminderLevel(l, now) >= 2).length, longestWaitMinutes: waiting.reduce((m, l) => Math.max(m, minutesWaiting(l.assignedAt, now)), 0) },
      leads: leads.map((l) => serializeLead(l, now, guard.isAdmin ? 'admin' : 'store')),
    });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG, tableMissing: true }, { status: 503 });
    console.error('GET /api/store/leads error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The received leads could not be loaded.' }, { status: 500 });
  }
}
