import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { getProductsWithTotals } from '@/lib/productStats';

export const dynamic = 'force-dynamic';

/** All products (active and disabled) with stock totals across every store. */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  const products = await getProductsWithTotals(false);
  return NextResponse.json({ total: products.length, products });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

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
