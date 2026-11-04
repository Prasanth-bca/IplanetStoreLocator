import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkUpdate } from '@/lib/storeLeads/rules';
import { forgetStoreAccount, MISSING_MSG, requireStoreAccess, serializeLead, tableMissing, withLast } from '@/lib/storeLeads/server';
import { timelineOf } from '@/lib/storeLeads/timeline';

export const dynamic = 'force-dynamic';

/** A lead the caller may touch: a store login only its own store's, an admin any. Anything else looks like "not found". */
async function ownLead(id: string, guard: { isAdmin: boolean; posCode: string | null }) {
  const lead = await prisma.storeLead.findUnique({ where: { id }, include: withLast });
  if (!lead) return null;
  if (!guard.isAdmin && lead.posCode.toLowerCase() !== (guard.posCode ?? '').toLowerCase()) return null;
  return lead;
}

/** The full follow-up history of one lead (nothing is overwritten), including the automatic reminders. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireStoreAccess(request);
  if (!guard.ok) return guard.response;
  try {
    const lead = await ownLead(params.id, guard);
    if (!lead) return NextResponse.json({ error: 'That lead was not found.' }, { status: 404 });
    return NextResponse.json({ serverNow: new Date().toISOString(), lead: serializeLead(lead, new Date(), guard.isAdmin ? 'admin' : 'store'), timeline: await timelineOf(lead.id, guard.isAdmin ? 'admin' : 'store') });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG }, { status: 503 });
    console.error('GET /api/store/leads/[id] error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The history could not be loaded.' }, { status: 500 });
  }
}

/**
 * Record a follow-up. Body: any of { interest, visitIntention, conversion, billedName, billedMobile, remark }.
 * The first valid one (a remark or any of the three choices) counts as the store's response and stops the reminders.
 * Closing needs the billed customer's name and mobile. Every update is added to the history.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireStoreAccess(request);
  if (!guard.ok) return guard.response;
  try {
    const lead = await ownLead(params.id, guard);
    if (!lead) return NextResponse.json({ errors: ['That lead was not found.'] }, { status: 404 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ errors: ['Invalid request.'] }, { status: 400 });

    const c = checkUpdate(lead, body as Record<string, unknown>, guard.isAdmin);
    if (!c.ok) return NextResponse.json({ errors: c.errors }, { status: 400 });
    const { set, remark, isResponse, becomesClosed } = c.data;
    const now = new Date();
    const who = guard.isAdmin ? `${guard.user.name} (admin)` : guard.user.name;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.storeLead.update({
        where: { id: lead.id },
        data: {
          ...set,
          lastActivityAt: now,
          ...(isResponse && !lead.firstResponseAt ? { firstResponseAt: now } : {}),
          ...(set.visitIntention ? { visitUpdatedAt: now } : {}),
          ...(set.conversion ? { closedAt: becomesClosed ? now : null } : {}),
        },
        include: withLast,
      });
      await tx.leadActivity.create({
        data: {
          storeLeadId: lead.id, byUserId: guard.user.id, byName: who, kind: becomesClosed ? 'CLOSED' : 'FOLLOW_UP', note: remark,
          interest: set.interest ?? null, visitIntention: set.visitIntention ?? null, conversion: set.conversion ?? null,
        },
      });
      // A response answers any pending reminder: they stop showing as unread alerts.
      if (isResponse) await tx.leadNotification.updateMany({ where: { storeLeadId: lead.id, readAt: null }, data: { readAt: now, readByName: who } });
      return row;
    });
    return NextResponse.json({ lead: serializeLead(updated, now, guard.isAdmin ? 'admin' : 'store'), celebrate: becomesClosed, serverNow: now.toISOString() });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ errors: [MISSING_MSG] }, { status: 503 });
    console.error('PATCH /api/store/leads/[id] error:', (error as Error)?.message);
    return NextResponse.json({ errors: ['The update could not be saved. Please try again.'] }, { status: 500 });
  }
}
