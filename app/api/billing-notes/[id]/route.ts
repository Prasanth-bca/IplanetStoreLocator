import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, requireUser } from '@/lib/auth';
import { todayIST } from '@/lib/leads';
import { isoToDate } from '@/lib/offers/dates';
import { checkNote } from '@/lib/billing/validate';
import { serialize, tableMissing } from '@/lib/billing/query';

export const dynamic = 'force-dynamic';

/** The person who made the note, or an admin, can change it. Send only the fields that changed. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const cur = await prisma.billingNote.findUnique({ where: { id: params.id } });
    // A note that isn't yours looks exactly like one that doesn't exist.
    if (!cur || (auth.user.role !== 'ADMIN' && cur.createdById !== auth.user.id)) return NextResponse.json({ errors: ['That note no longer exists.'] }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ errors: ['Invalid request.'] }, { status: 400 });
    const merged = {
      bookingDate: cur.bookingDate.toISOString().slice(0, 10), billedPhone: cur.billedPhone, dialledPhone: cur.dialledPhone, customerName: cur.customerName,
      model: cur.model, location: cur.location, status: cur.status, invoice: cur.invoice, value: cur.value, remarks: cur.remarks, agentCode: cur.agentCode,
      ...(body as Record<string, unknown>),
    };
    const c = checkNote(merged, todayIST());
    if (!c.ok) return NextResponse.json({ errors: c.errors }, { status: 400 });
    const d = c.data;
    const row = await prisma.billingNote.update({ where: { id: cur.id }, data: { ...d, bookingDate: isoToDate(d.bookingDate), updatedByName: auth.user.name } });
    return NextResponse.json({ item: serialize(row, { id: auth.user.id, role: auth.user.role }) });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ errors: ['The billing notes table has not been created yet.'] }, { status: 503 });
    console.error('PATCH /api/billing-notes/[id] error:', (error as Error)?.message);
    return NextResponse.json({ errors: ['The note could not be saved.'] }, { status: 500 });
  }
}

/** Admin only. Reps can edit a mistaken note instead; deleting is left to an admin so there is always a record. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    await prisma.billingNote.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2025') return NextResponse.json({ error: 'That note no longer exists.' }, { status: 404 });
    console.error('DELETE /api/billing-notes/[id] error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The note could not be deleted.' }, { status: 500 });
  }
}
