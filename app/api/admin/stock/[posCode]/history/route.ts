import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decodePosCode, findStoreByPosCode } from '@/lib/stock';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { posCode: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const store = await findStoreByPosCode(decodePosCode(params.posCode));
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') || '50') || 50, 200);

    const movements = await prisma.stockMovement.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { product: { select: { sku: true, name: true, variant: true } } },
    });

    return NextResponse.json({
      history: movements.map(m => ({
        id: m.id,
        sku: m.product.sku,
        name: m.product.name,
        variant: m.product.variant,
        delta: m.delta,
        newQty: m.newQty,
        reason: m.reason,
        note: m.note,
        user: m.user,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/stock/[posCode]/history error:', error);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
