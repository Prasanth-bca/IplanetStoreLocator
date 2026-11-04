import { NextRequest, NextResponse } from 'next/server';
import { updateStore, deleteStore } from '@/lib/storeRepo';
import { requireRole } from '@/lib/auth';
import { checkStoreFields, STORE_STATUSES } from '@/lib/storeInput';
import { prisma } from '@/lib/prisma';
import type { StoreStatus } from '@/types/store';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    let changes;
    if (Object.keys(body).length === 1 && typeof body.status === 'string') {
      // The status drop-down on the list sends only the status.
      if (!STORE_STATUSES.includes(body.status as StoreStatus)) return NextResponse.json({ error: 'Choose a valid status.' }, { status: 400 });
      changes = { status: body.status as StoreStatus };
    } else {
      // The edit form sends every field; the POS code and category are never changed.
      const existing = await prisma.store.findFirst({ where: { OR: [{ id }, { posCode: id }] } });
      if (!existing) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      const checked = checkStoreFields({ ...existing, ...body });
      if (!checked.ok) return NextResponse.json({ error: checked.errors.join(' '), errors: checked.errors }, { status: 400 });
      changes = checked.value;
    }
    const updated = await updateStore(id, changes);
    if (!updated) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, store: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const { id } = params;
    const success = await deleteStore(id);
    if (!success) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
  }
}
