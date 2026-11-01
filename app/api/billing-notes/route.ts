import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { todayIST } from '@/lib/leads';
import { isoToDate } from '@/lib/offers/dates';
import { checkNote } from '@/lib/billing/validate';
import { buildWhere, serialize, tableMissing, Viewer } from '@/lib/billing/query';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;
const MISSING = 'The billing notes table has not been created yet. Ask the admin to run prisma/manual/billing_notes.sql.';

/**
 * Any signed-in person. A sales person gets only their own notes; an admin gets everyone's.
 * Query: q (phone number or words), status, from, to, location, page; admin only: agent (user id), mine=1.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const viewer: Viewer = { id: auth.user.id, role: auth.user.role };

  try {
    const sp = request.nextUrl.searchParams;
    const page = Math.max(0, Math.min(1000, Number(sp.get('page')) || 0));
    const where = buildWhere(viewer, sp);
    const [rows, total, grouped, agents] = await Promise.all([
      prisma.billingNote.findMany({ where, orderBy: [{ bookingDate: 'desc' }, { createdAt: 'desc' }], skip: page * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.billingNote.count({ where }),
      // counts for the status chips: same filters, ignoring the status filter itself
      prisma.billingNote.groupBy({ by: ['status'], where: buildWhere(viewer, sp, { ignoreStatus: true }), _count: { _all: true } }),
      viewer.role === 'ADMIN' ? prisma.billingNote.groupBy({ by: ['createdById', 'agentName'], _count: { _all: true }, orderBy: { agentName: 'asc' } }) : Promise.resolve([]),
    ]);
    const counts: Record<string, number> = { NOTED: 0, NOT_BILLED: 0, BILLED: 0 };
    grouped.forEach((g) => (counts[g.status] = g._count._all));
    return NextResponse.json({
      today: todayIST(),
      items: rows.map((r) => serialize(r, viewer)),
      total,
      page,
      pageSize: PAGE_SIZE,
      counts,
      agents: agents.filter((a) => a.createdById).map((a) => ({ id: a.createdById as string, name: a.agentName, count: a._count._all })),
    });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING, tableMissing: true }, { status: 503 });
    console.error('GET /api/billing-notes error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The notes could not be loaded.' }, { status: 500 });
  }
}

/** Any signed-in person adds a note in their own name. */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ errors: ['Invalid request.'] }, { status: 400 });
    const c = checkNote(body as Record<string, unknown>, todayIST());
    if (!c.ok) return NextResponse.json({ errors: c.errors }, { status: 400 });
    const d = c.data;

    // The same person noting the same sale twice (double click, or re-entering it later).
    // (Only checked when both numbers are given: a note with a number missing can't be told apart from a different one.)
    const dup = d.billedPhone && d.dialledPhone
      ? await prisma.billingNote.findFirst({
          where: { createdById: auth.user.id, billedPhone: d.billedPhone, dialledPhone: d.dialledPhone, bookingDate: isoToDate(d.bookingDate), model: d.model ? { equals: d.model, mode: 'insensitive' } : null },
          select: { id: true },
        })
      : null;
    if (dup) return NextResponse.json({ errors: ['You have already noted these two numbers for this date and model. Edit that note instead.'], duplicateId: dup.id }, { status: 409 });

    const row = await prisma.billingNote.create({
      data: { ...d, bookingDate: isoToDate(d.bookingDate), agentName: auth.user.name, createdById: auth.user.id, updatedByName: auth.user.name },
    });
    return NextResponse.json({ item: serialize(row, { id: auth.user.id, role: auth.user.role }) }, { status: 201 });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ errors: [MISSING] }, { status: 503 });
    console.error('POST /api/billing-notes error:', (error as Error)?.message);
    return NextResponse.json({ errors: ['The note could not be saved.'] }, { status: 500 });
  }
}
