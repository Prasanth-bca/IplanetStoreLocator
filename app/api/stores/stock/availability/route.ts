import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stockStatus } from '@/lib/stock';

export const dynamic = 'force-dynamic';

/** Body: { sku: string, posCodes: string[] } -> availability of one product across the given stores. */
export async function POST(request: NextRequest) {
  try {
    const { sku, posCodes } = await request.json();
    if (!sku || !Array.isArray(posCodes) || posCodes.length === 0) {
      return NextResponse.json({ error: 'sku and a non-empty posCodes array are required' }, { status: 400 });
    }
    if (posCodes.length > 50) {
      return NextResponse.json({ error: 'At most 50 posCodes per request' }, { status: 400 });
    }

    const product = await prisma.product.findFirst({
      where: { sku: { equals: String(sku), mode: 'insensitive' }, active: true },
    });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const stores = await prisma.store.findMany({
      where: { posCode: { in: posCodes.map(String) } },
      select: { posCode: true, stock: { where: { productId: product.id } } },
    });

    return NextResponse.json({
      product: { sku: product.sku, name: product.name, variant: product.variant },
      availability: stores.map(s => ({
        posCode: s.posCode,
        status: stockStatus(s.stock[0]?.quantity, s.stock[0]?.lowStockThreshold),
      })),
    });
  } catch (error) {
    console.error('POST /api/stores/stock/availability error:', error);
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 });
  }
}
