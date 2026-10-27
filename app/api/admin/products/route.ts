import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** All products (active and disabled) with stock totals across every store. */
export async function GET() {
  const [products, totals, stocked] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }, { variant: 'asc' }] }),
    prisma.storeStock.groupBy({ by: ['productId'], _sum: { quantity: true } }),
    prisma.storeStock.groupBy({ by: ['productId'], where: { quantity: { gt: 0 } }, _count: { _all: true } }),
  ]);

  const unitsBy = new Map(totals.map(t => [t.productId, t._sum.quantity ?? 0]));
  const storesBy = new Map(stocked.map(t => [t.productId, t._count._all]));

  return NextResponse.json({
    total: products.length,
    products: products.map(p => ({
      ...p,
      totalUnits: unitsBy.get(p.id) ?? 0,
      storesInStock: storesBy.get(p.id) ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sku = String(body.sku || '').trim();
    const name = String(body.name || '').trim();
    const category = String(body.category || '').trim();
    if (!sku || !name || !category) {
      return NextResponse.json({ error: 'SKU, name and category are required' }, { status: 400 });
    }
    if (sku.length > 60 || name.length > 120 || category.length > 40) {
      return NextResponse.json({ error: 'SKU, name or category is too long' }, { status: 400 });
    }

    const existing = await prisma.product.findFirst({ where: { sku: { equals: sku, mode: 'insensitive' } } });
    if (existing) {
      return NextResponse.json({ error: `Product with SKU ${sku} already exists` }, { status: 409 });
    }

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        category,
        variant: body.variant ? String(body.variant).trim().slice(0, 80) : null,
        active: body.active === false ? false : true,
      },
    });
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('POST /api/admin/products error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
