import { NextRequest, NextResponse } from 'next/server';
import { getRetailStores, saveRetailStores } from '@/lib/storeRepo';
import { Store } from '@/types/store';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const stores = getRetailStores();

    const idx = stores.findIndex(s => s.id === id || s.posCode === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const current = stores[idx];
    const updated: Store = {
      ...current,
      ...body,
      id: current.id,
      updatedAt: new Date().toISOString()
    };

    stores[idx] = updated;
    saveRetailStores(stores);

    return NextResponse.json({ success: true, store: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const stores = getRetailStores();

    const filtered = stores.filter(s => s.id !== id && s.posCode !== id);
    if (filtered.length === stores.length) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    saveRetailStores(filtered);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
  }
}
