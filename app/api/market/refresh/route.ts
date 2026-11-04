import { NextRequest, NextResponse } from 'next/server';
import { requireMarketAccess, savePrice } from '@/lib/market/server';
import { checkPrice, matchesQuery } from '@/lib/market/rules';
import { configuredProviders } from '@/lib/market/providers';

export const dynamic = 'force-dynamic';

/** Refresh Prices: asks every connected live source for this product. With none connected it says so and changes nothing. */
export async function POST(request: NextRequest) {
  const auth = await requireMarketAccess(request);
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const q = typeof body.query === 'string' ? body.query.trim().slice(0, 100) : '';
  if (q.length < 2) return NextResponse.json({ error: 'Enter a product to refresh.' }, { status: 400 });
  const providers = configuredProviders();
  if (!providers.length) {
    return NextResponse.json({ success: true, connected: 0, updated: 0, message: 'No live price source is connected yet, so nothing could be refreshed. Prices shown are the last saved ones.' });
  }
  let updated = 0;
  const failed: string[] = [];
  for (const p of providers) {
    try {
      for (const l of await p.fetchListings(q)) {
        const c = checkPrice(l);
        if (!c.ok || !matchesQuery(c.value.productLabel, q)) continue; // never save something that doesn't validate or isn't what was asked for
        await savePrice(c.value, { kind: 'API', sourceName: l.sourceName || p.name });
        updated++;
      }
    } catch (e) {
      console.error(`market provider ${p.id} failed:`, (e as Error)?.message);
      failed.push(p.name);
    }
  }
  return NextResponse.json({ success: true, connected: providers.length, updated, failed, message: updated ? `Updated ${updated} price${updated === 1 ? '' : 's'}.` : 'The live source returned no matching prices.' });
}
