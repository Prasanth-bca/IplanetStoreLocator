import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { checkShare, statusOf, summarise, summariseBy } from '@/lib/storeLeads/rules';
import { MAX_ROWS, MISSING_MSG, rangeFrom, serializeLead, tableMissing, withLast } from '@/lib/storeLeads/server';

export const dynamic = 'force-dynamic';

/**
 * A sales user (or admin) shares a customer lead directly with one store. The lead goes to that store's Received Leads,
 * is recorded in the sender's Lead History, and keeps who shared it, which store got it and the exact time.
 * `clientId` makes it safe to send twice: the second call returns the first lead instead of creating another.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.role === 'STORE') return NextResponse.json({ errors: ['A store login can’t share leads.'] }, { status: 403 });

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ errors: ['Invalid request.'] }, { status: 400 });
    const c = checkShare(body as Record<string, unknown>);
    if (!c.ok) return NextResponse.json({ errors: c.errors }, { status: 400 });
    const d = c.data;

    // The store name always comes from the database, never from the browser.
    const store = await prisma.store.findFirst({
      where: { posCode: { equals: d.posCode, mode: 'insensitive' }, category: 'Retail', status: 'Active' },
      select: { posCode: true, storeName: true },
    });
    if (!store) return NextResponse.json({ errors: ['That store was not found or is not active.'] }, { status: 404 });
    const account = await prisma.storeAccount.findUnique({ where: { posCode: store.posCode }, select: { id: true } });
    if (!account) return NextResponse.json({ errors: [`${store.storeName} doesn’t have a store login yet, so it can’t receive leads. Ask the admin to create it.`] }, { status: 409 });

    const existing = await prisma.storeLead.findUnique({ where: { clientId: d.clientId }, select: { id: true } });
    if (existing) return NextResponse.json({ success: true, duplicate: true, id: existing.id });

    try {
      const created = await prisma.$transaction(async (tx) => {
        // Also recorded in the existing Lead History (channel "store") so it shows under the sender's leads, like any other lead.
        const lead = await tx.lead.create({
          data: { clientId: `sl-${d.clientId}`, customerName: d.customerName, customerMobile: d.customerMobile, storeName: store.storeName, posCode: store.posCode, product: d.requirement, remarks: d.remarks, channel: 'store', userId: auth.user.id, userName: auth.user.name },
        });
        const sl = await tx.storeLead.create({
          data: {
            clientId: d.clientId, customerName: d.customerName, customerMobile: d.customerMobile, requirement: d.requirement, remarks: d.remarks, posCode: store.posCode, storeName: store.storeName,
            sharedById: auth.user.id, sharedByName: auth.user.name, leadId: lead.id,
          },
        });
        await tx.leadActivity.create({ data: { storeLeadId: sl.id, byUserId: auth.user.id, byName: auth.user.name, kind: 'ASSIGNED', note: d.remarks } });
        return sl;
      });
      return NextResponse.json({ success: true, duplicate: false, id: created.id, assignedAt: created.assignedAt.toISOString(), storeName: store.storeName }, { status: 201 });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await prisma.storeLead.findUnique({ where: { clientId: d.clientId }, select: { id: true } });
        return NextResponse.json({ success: true, duplicate: true, id: again?.id });
      }
      throw err;
    }
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ errors: [MISSING_MSG] }, { status: 503 });
    console.error('POST /api/store-leads error:', (error as Error)?.message);
    return NextResponse.json({ errors: ['The lead could not be shared. Please try again.'] }, { status: 500 });
  }
}

/**
 * The leads the signed-in person has shared, with each lead's latest outcome, for one day (?date=) or month (?month=)
 * (default today; ?all=1 for everything). Optional ?posCode= and ?status=. Always only their own, whoever asks.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.role === 'STORE') return NextResponse.json({ error: 'You don’t have permission to do this.' }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const range = rangeFrom(sp);
  if (!range) return NextResponse.json({ error: 'Use date=YYYY-MM-DD or month=YYYY-MM' }, { status: 400 });
  try {
    const now = new Date();
    const posCode = sp.get('posCode')?.trim();
    const rows = await prisma.storeLead.findMany({
      where: { sharedById: auth.user.id, assignedAt: { gte: range.start, lt: range.end }, ...(posCode ? { posCode: { equals: posCode, mode: 'insensitive' as const } } : {}) },
      include: withLast,
      orderBy: { assignedAt: 'desc' },
      take: MAX_ROWS + 1,
    });
    const truncated = rows.length > MAX_ROWS;
    const all = truncated ? rows.slice(0, MAX_ROWS) : rows;
    const status = sp.get('status');
    const leads = status ? all.filter((l) => statusOf(l) === status) : all;
    return NextResponse.json({
      serverNow: now.toISOString(),
      range: range.label,
      total: leads.length,
      truncated,
      summary: summarise(all, now),
      byStore: summariseBy(all, (l) => l.posCode, (l) => `${l.posCode} · ${l.storeName}`, now).map((g) => ({ posCode: g.key, label: g.label, ...g.summary })),
      leads: leads.map((l) => serializeLead(l, now, 'sales')),
    });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG, tableMissing: true }, { status: 503 });
    console.error('GET /api/store-leads error:', (error as Error)?.message);
    return NextResponse.json({ error: 'Your shared leads could not be loaded.' }, { status: 500 });
  }
}
