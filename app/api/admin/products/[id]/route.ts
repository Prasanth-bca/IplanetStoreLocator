import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Body: any of { sku, name, category, variant, active }. Disabling hides a product from customers and the stock screen. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const current = await prisma.product.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const body = await request.json();
    const data: { sku?: string; name?: string; category?: string; variant?: string | null; active?: boolean } = {};

    if (body.sku !== undefined) {
      const sku = String(body.sku).trim();
      if (!sku || sku.length > 60) return NextResponse.json({ error: 'SKU is required (max 60 characters)' }, { status: 400 });
      if (sku.toLowerCase() !== current.sku.toLowerCase()) {
        const clash = await prisma.product.findFirst({ where: { sku: { equals: sku, mode: 'insensitive' }, NOT: { id: current.id } } });
        if (clash) return NextResponse.json({ error: `Product with SKU ${sku} already exists` }, { status: 409 });
      }
      data.sku = sku;
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || name.length > 120) return NextResponse.json({ error: 'Name is required (max 120 characters)' }, { status: 400 });
      data.name = name;
    }
    if (body.category !== undefined) {
      const category = String(body.category).trim();
      if (!category || category.length > 40) return NextResponse.json({ error: 'Category is required (max 40 characters)' }, { status: 400 });
      data.category = category;
    }
    if (body.variant !== undefined) {
      data.variant = body.variant ? String(body.variant).trim().slice(0, 80) : null;
    }
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') return NextResponse.json({ error: 'active must be true or false' }, { status: 400 });
      data.active = body.active;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const product = await prisma.product.update({ where: { id: current.id }, data });
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('PATCH /api/admin/products/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

/** Deleting cascades to stock rows, so it is refused once a product has stock history. Disable it instead. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const movements = await prisma.stockMovement.count({ where: { productId: product.id } });
    if (movements > 0) {
      return NextResponse.json(
        { error: `${product.name} has ${movements} stock record${movements === 1 ? '' : 's'} in its history, so it can't be deleted. Disable it instead.` },
        { status: 409 }
      );
    }

    await prisma.product.delete({ where: { id: product.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/products/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
