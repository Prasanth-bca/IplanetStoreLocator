import { NextRequest, NextResponse } from 'next/server';
import { decodePosCode, findStoreByPosCode, getStoreStock } from '@/lib/stock';

export const dynamic = 'force-dynamic';

/** Customer-facing stock view: each product's available quantity and a status. */
export async function GET(request: NextRequest, { params }: { params: { posCode: string } }) {
  try {
    const store = await findStoreByPosCode(decodePosCode(params.posCode));
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const q = (new URL(request.url).searchParams.get('q') || '').trim().toLowerCase();
    const category = new URL(request.url).searchParams.get('category');

    let rows = await getStoreStock(store.id);
    if (category) rows = rows.filter(r => r.category.toLowerCase() === category.toLowerCase());
    if (q) rows = rows.filter(r => `${r.name} ${r.variant ?? ''} ${r.sku}`.toLowerCase().includes(q));

    return NextResponse.json({
      store: { posCode: store.posCode, storeName: store.storeName },
      items: rows.map(r => ({
        sku: r.sku,
        name: r.name,
        category: r.category,
        variant: r.variant,
        quantity: r.quantity,
        status: r.status,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/stores/[posCode]/stock error:', error);
    return NextResponse.json({ error: 'Failed to load stock' }, { status: 500 });
  }
}
