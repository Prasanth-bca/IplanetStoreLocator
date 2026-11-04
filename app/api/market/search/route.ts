import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MISSING_MSG, requireMarketAccess, serializeRow, tableMissing } from '@/lib/market/server';
import { matchesQuery } from '@/lib/market/rules';
import { configuredProviders } from '@/lib/market/providers';

export const dynamic = 'force-dynamic';

/** Saved prices for every exact product matching the search, grouped by product + variant (never mixed). */
export async function GET(request: NextRequest) {
  const auth = await requireMarketAccess(request);
  if (!auth.ok) return auth.response;
  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 100);
  const category = (request.nextUrl.searchParams.get('category') || '').trim();
  try {
    const rows = await prisma.marketPrice.findMany({ where: category ? { category } : undefined, include: { offers: true }, orderBy: { productLabel: 'asc' }, take: 1500 });
    const groups = new Map<string, { productKey: string; label: string; category: string; rows: ReturnType<typeof serializeRow>[] }>();
    for (const r of rows) {
      if (q && !matchesQuery(r.productLabel, q)) continue;
      const g = groups.get(r.productKey) ?? { productKey: r.productKey, label: r.productLabel, category: r.category, rows: [] };
      g.rows.push(serializeRow(r));
      groups.set(r.productKey, g);
    }
    return NextResponse.json({ serverNow: new Date().toISOString(), query: q, groups: Array.from(groups.values()).slice(0, 40), liveSources: configuredProviders().map((p) => p.name) });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG, tableMissing: true }, { status: 503 });
    console.error('GET /api/market/search error:', (error as Error)?.message);
    return NextResponse.json({ error: 'Prices could not be loaded.' }, { status: 500 });
  }
}
