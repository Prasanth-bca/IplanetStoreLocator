import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getProductsWithTotals } from '@/lib/productStats';

export const dynamic = 'force-dynamic';

/** Read-only product catalogue for everyone signed in: enabled products only. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const products = await getProductsWithTotals(true);
  return NextResponse.json({
    total: products.length,
    products: products.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      variant: p.variant,
      totalUnits: p.totalUnits,
      storesInStock: p.storesInStock,
    })),
  });
}
