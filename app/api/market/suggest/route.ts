import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMarketAccess, tableMissing } from '@/lib/market/server';
import { matchesQuery } from '@/lib/market/rules';

export const dynamic = 'force-dynamic';

/** Autocomplete: product names from the catalogue plus every product that already has a saved price. */
export async function GET(request: NextRequest) {
  const auth = await requireMarketAccess(request);
  if (!auth.ok) return auth.response;
  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ suggestions: [] });
  try {
    const products = await prisma.product.findMany({ where: { active: true, name: { contains: q.split(/\s+/)[0], mode: 'insensitive' } }, select: { name: true }, take: 200 });
    let priced: { productLabel: string }[] = [];
    try {
      priced = await prisma.marketPrice.findMany({ distinct: ['productKey'], select: { productLabel: true }, take: 500 });
    } catch (e) {
      if (!tableMissing(e)) throw e;
    }
    const seen = new Set<string>();
    const out: { label: string; hasPrices: boolean }[] = [];
    const pricedSet = new Set(priced.map((p) => p.productLabel.toLowerCase()));
    for (const label of [...priced.map((p) => p.productLabel), ...products.map((p) => p.name)]) {
      const k = label.toLowerCase();
      if (seen.has(k) || !matchesQuery(label, q)) continue;
      seen.add(k);
      out.push({ label, hasPrices: pricedSet.has(k) });
      if (out.length >= 10) break;
    }
    return NextResponse.json({ suggestions: out });
  } catch (error) {
    console.error('GET /api/market/suggest error:', (error as Error)?.message);
    return NextResponse.json({ suggestions: [] });
  }
}
