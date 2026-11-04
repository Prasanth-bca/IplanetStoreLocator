import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { reminderLevel, statusOf, summarise, summariseBy, minutesWaiting } from '@/lib/storeLeads/rules';
import { ensureReminders, MAX_ROWS, MISSING_MSG, rangeFrom, serializeLead, tableMissing, withLast } from '@/lib/storeLeads/server';

export const dynamic = 'force-dynamic';

/**
 * Admin: every store lead for a day or month (?date= / ?month= / ?all=1), with optional ?posCode= ?userId= ?status=,
 * consolidated numbers overall, per store and per sales user, who is waiting beyond 20 and 40 minutes (right now, any date),
 * and the reminder history.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  const sp = request.nextUrl.searchParams;
  const range = rangeFrom(sp);
  if (!range) return NextResponse.json({ error: 'Use date=YYYY-MM-DD or month=YYYY-MM' }, { status: 400 });

  try {
    await ensureReminders().catch(() => 0);
    const now = new Date();
    const posCode = sp.get('posCode')?.trim();
    const userId = sp.get('userId')?.trim();
    const rows = await prisma.storeLead.findMany({
      where: {
        assignedAt: { gte: range.start, lt: range.end },
        ...(posCode ? { posCode: { equals: posCode, mode: 'insensitive' as const } } : {}),
        ...(userId ? { sharedById: userId } : {}),
      },
      include: withLast,
      orderBy: { assignedAt: 'desc' },
      take: MAX_ROWS + 1,
    });
    const truncated = rows.length > MAX_ROWS;
    const all = truncated ? rows.slice(0, MAX_ROWS) : rows;
    const status = sp.get('status');
    const leads = status ? all.filter((l) => statusOf(l) === status || (status === 'OVERDUE' && serializeLead(l, now, 'admin').overdueFollowUp) || (status === 'WAITING20' && reminderLevel(l, now) >= 1) || (status === 'WAITING40' && reminderLevel(l, now) >= 2)) : all;

    // Waiting RIGHT NOW (any date), because an unanswered lead matters whenever it was shared.
    const waiting = await prisma.storeLead.findMany({
      where: { firstResponseAt: null, conversion: null },
      select: { id: true, posCode: true, storeName: true, customerName: true, assignedAt: true, firstResponseAt: true, conversion: true },
      orderBy: { assignedAt: 'asc' },
      take: 500,
    });

    const [stores, sales, notes] = await Promise.all([
      prisma.storeLead.groupBy({ by: ['posCode', 'storeName'], _count: { _all: true }, orderBy: { posCode: 'asc' } }),
      prisma.storeLead.groupBy({ by: ['sharedById', 'sharedByName'], _count: { _all: true }, orderBy: { sharedByName: 'asc' } }),
      prisma.leadNotification.findMany({
        where: { dueAt: { gte: range.start, lt: range.end }, ...(posCode ? { posCode: { equals: posCode, mode: 'insensitive' as const } } : {}) },
        include: { storeLead: { select: { customerName: true, requirement: true, storeName: true, firstResponseAt: true, assignedAt: true } } },
        orderBy: { dueAt: 'desc' },
        take: 300,
      }),
    ]);

    return NextResponse.json({
      serverNow: now.toISOString(),
      range: range.label,
      total: leads.length,
      truncated,
      summary: summarise(all, now),
      byStore: summariseBy(all, (l) => l.posCode, (l) => `${l.posCode} · ${l.storeName}`, now).map((g) => ({ posCode: g.key, label: g.label, ...g.summary })),
      bySales: summariseBy(all, (l) => l.sharedById ?? 'unknown', (l) => l.sharedByName, now).map((g) => ({ userId: g.key, label: g.label, ...g.summary })),
      waitingNow: {
        total: waiting.length,
        over20: waiting.filter((w) => reminderLevel(w, now) >= 1).length,
        over40: waiting.filter((w) => reminderLevel(w, now) >= 2).length,
        leads: waiting.filter((w) => reminderLevel(w, now) >= 1).slice(0, 50).map((w) => ({ id: w.id, posCode: w.posCode, storeName: w.storeName, customerName: w.customerName, minutes: minutesWaiting(w.assignedAt, now), level: reminderLevel(w, now) })),
      },
      filters: { stores: stores.map((s) => ({ posCode: s.posCode, label: `${s.posCode} · ${s.storeName}`, count: s._count._all })), sales: sales.filter((s) => s.sharedById).map((s) => ({ id: s.sharedById as string, label: s.sharedByName, count: s._count._all })) },
      notifications: notes.map((n) => ({
        id: n.id, kind: n.kind, posCode: n.posCode, storeName: n.storeLead.storeName, customerName: n.storeLead.customerName, requirement: n.storeLead.requirement,
        dueAt: n.dueAt.toISOString(), createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null, readByName: n.readByName,
        answeredAt: n.storeLead.firstResponseAt?.toISOString() ?? null, assignedAt: n.storeLead.assignedAt.toISOString(),
      })),
      leads: leads.map((l) => serializeLead(l, now, 'admin')),
    });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG, tableMissing: true }, { status: 503 });
    console.error('GET /api/admin/store-leads error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The store leads could not be loaded.' }, { status: 500 });
  }
}
