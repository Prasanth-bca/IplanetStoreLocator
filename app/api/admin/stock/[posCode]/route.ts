import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import {
  applyStockChanges,
  decodePosCode,
  findStoreByPosCode,
  getStoreStock,
  StockChange,
  STOCK_REASONS,
} from '@/lib/stock';

export const dynamic = 'force-dynamic';

/** Admin view: includes exact quantities and thresholds. */
export async function GET(request: NextRequest, { params }: { params: { posCode: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const store = await findStoreByPosCode(decodePosCode(params.posCode));
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    const items = await getStoreStock(store.id);
    return NextResponse.json({ store, items });
  } catch (error) {
    console.error('GET /api/admin/stock/[posCode] error:', error);
    return NextResponse.json({ error: 'Failed to load stock' }, { status: 500 });
  }
}

/**
 * Body: { updates: [{ productId, quantity? | delta?, lowStockThreshold? }], reason, note? }
 * All updates apply in one transaction, each recorded in the movement log.
 */
export async function PATCH(request: NextRequest, { params }: { params: { posCode: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const store = await findStoreByPosCode(decodePosCode(params.posCode));
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const body = await request.json();
    const updates: StockChange[] = Array.isArray(body.updates) ? body.updates : [];
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }
    const reason = String(body.reason || 'Correction');
    if (!(STOCK_REASONS as readonly string[]).includes(reason)) {
      return NextResponse.json({ error: `Reason must be one of: ${STOCK_REASONS.join(', ')}` }, { status: 400 });
    }

    for (const u of updates) {
      if (!u.productId) {
        return NextResponse.json({ error: 'Each update needs a productId' }, { status: 400 });
      }
      if (u.quantity === undefined && u.delta === undefined && u.lowStockThreshold === undefined) {
        return NextResponse.json({ error: `Update for ${u.productId} has nothing to change` }, { status: 400 });
      }
      for (const v of [u.quantity, u.delta, u.lowStockThreshold]) {
        if (v !== undefined && !Number.isInteger(v)) {
          return NextResponse.json({ error: 'Quantities and thresholds must be whole numbers' }, { status: 400 });
        }
      }
      if ((u.quantity !== undefined && u.quantity < 0) || (u.lowStockThreshold !== undefined && u.lowStockThreshold < 0)) {
        return NextResponse.json({ error: 'Quantities and thresholds cannot be negative' }, { status: 400 });
      }
    }

    const ids = Array.from(new Set(updates.map(u => u.productId)));
    const found = await prisma.product.count({ where: { id: { in: ids } } });
    if (found !== ids.length) {
      return NextResponse.json({ error: 'One or more products do not exist' }, { status: 400 });
    }

    const note = body.note ? String(body.note).slice(0, 500) : null;
    const updated = await applyStockChanges(store.id, updates, reason, note, 'admin');
    return NextResponse.json({ success: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update stock';
    const isValidation = message.startsWith('Invalid quantity');
    if (!isValidation) console.error('PATCH /api/admin/stock/[posCode] error:', error);
    return NextResponse.json({ error: message }, { status: isValidation ? 400 : 500 });
  }
}
