/** Server helpers for Market Price & Offers: who may open it, and shaping rows for the pages. */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, SessionUser } from '@/lib/auth';

export const tableMissing = (e: unknown) => ['P2021', 'P2022'].includes((e as { code?: string })?.code ?? '');
export const MISSING_MSG = 'The Market Price tables have not been created yet. Ask the admin to run prisma/manual/market_price.sql.';

export interface MarketAccess { salesEnabled: boolean; storeEnabled: boolean; tableMissing: boolean }
let cache: { at: number; value: MarketAccess } | null = null;
export const forgetMarketAccess = () => { cache = null; };

/** Defaults when nothing is saved: sales users can open it, store users can't. */
export async function getMarketAccess(): Promise<MarketAccess> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  let value: MarketAccess = { salesEnabled: true, storeEnabled: false, tableMissing: false };
  try {
    const row = await prisma.marketSetting.findUnique({ where: { id: 'default' } });
    if (row) value = { salesEnabled: row.salesEnabled, storeEnabled: row.storeEnabled, tableMissing: false };
  } catch (e) {
    if (tableMissing(e)) value = { ...value, tableMissing: true };
    else throw e;
  }
  cache = { at: Date.now(), value };
  return value;
}

export const roleMayOpen = (role: SessionUser['role'], a: MarketAccess) => role === 'ADMIN' || (role === 'SALES' && a.salesEnabled) || (role === 'STORE' && a.storeEnabled);

/** For the routes sales/store users call: signed in, and the admin has switched the module on for their role. */
export async function requireMarketAccess(request: NextRequest): Promise<{ ok: true; user: SessionUser } | { ok: false; response: NextResponse }> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  const a = await getMarketAccess();
  if (!roleMayOpen(auth.user.role, a)) return { ok: false, response: NextResponse.json({ error: 'Market Price & Offers is not enabled for your role. Ask the admin.' }, { status: 403 }) };
  return auth;
}

type Row = Awaited<ReturnType<typeof prisma.marketPrice.findMany<{ include: { offers: true } }>>>[number];
export const serializeRow = (r: Row) => ({
  id: r.id,
  platform: r.platform,
  retailerName: r.retailerName,
  mrp: r.mrp,
  sellingPrice: r.sellingPrice,
  availability: r.availability,
  sourceUrl: r.sourceUrl,
  sourceKind: r.sourceKind,
  sourceName: r.sourceName,
  enteredByName: r.enteredByName,
  fetchedAt: r.fetchedAt.toISOString(),
  offers: r.offers.map((o) => ({
    id: o.id, kind: o.kind, title: o.title, bank: o.bank, discountAmount: o.discountAmount, discountPercent: o.discountPercent, minAmount: o.minAmount, maxDiscount: o.maxDiscount,
    validFrom: o.validFrom?.toISOString() ?? null, validUntil: o.validUntil?.toISOString() ?? null, variants: o.variants, terms: o.terms, link: o.link,
  })),
});

/** Save one price (replacing the same product + platform + retailer) with its offers, in one transaction. */
import type { PriceInput } from './rules';
import { productKey } from './rules';
export async function savePrice(input: PriceInput, by: { kind: 'MANUAL' | 'API'; sourceName?: string; enteredByName?: string }) {
  const key = productKey(input.productLabel);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.marketPrice.findFirst({ where: { productKey: key, platform: input.platform, retailerName: input.retailerName } });
    const data = {
      productLabel: input.productLabel, category: input.category, mrp: input.mrp, sellingPrice: input.sellingPrice, availability: input.availability,
      sourceUrl: input.sourceUrl, sourceKind: by.kind, sourceName: by.sourceName ?? null, enteredByName: by.enteredByName ?? null, fetchedAt: now,
    };
    const row = existing
      ? await tx.marketPrice.update({ where: { id: existing.id }, data })
      : await tx.marketPrice.create({ data: { ...data, productKey: key, platform: input.platform, retailerName: input.retailerName } });
    await tx.marketOffer.deleteMany({ where: { priceId: row.id } });
    if (input.offers.length) {
      await tx.marketOffer.createMany({
        data: input.offers.map((o) => ({ priceId: row.id, kind: o.kind, title: o.title, bank: o.bank, discountAmount: o.discountAmount, discountPercent: o.discountPercent, minAmount: o.minAmount, maxDiscount: o.maxDiscount, validFrom: o.validFrom ? new Date(o.validFrom) : null, validUntil: o.validUntil ? new Date(o.validUntil) : null, variants: o.variants, terms: o.terms, link: o.link })),
      });
    }
    return row;
  });
}
