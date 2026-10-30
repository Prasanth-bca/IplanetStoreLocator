import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { todayIST } from '@/lib/leads';
import { offersForProduct, runningCampaign } from '@/lib/offers/engine';
import { loadAllOffers } from '@/lib/offers/repo';
import type { OffersResponse } from '@/lib/offers/types';

export const dynamic = 'force-dynamic';

/**
 * The store and bank offers that apply today to one catalogue product (?sku=...). Without a sku it returns only
 * the campaign and data status, so the panels can show the festive label before anything is selected.
 * Expired, inactive and
 * not-yet-started offers are never included. A failure to load the data is an error response, which the
 * panels show differently from "no offer for this product".
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const sku = new URL(request.url).searchParams.get('sku')?.trim() || null;

  try {
    const [product, data] = await Promise.all([
      sku
        ? prisma.product.findFirst({
            where: { sku: { equals: sku, mode: 'insensitive' }, active: true },
            select: { sku: true, name: true, class: true, category: true, variant: true },
          })
        : Promise.resolve(null),
      loadAllOffers(),
    ]);
    if (sku && !product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const today = todayIST();
    const found = product ? offersForProduct(product, data.store, data.bank, today) : { store: [], bank: [], upcoming: { store: null, bank: null } };
    const campaign = runningCampaign(data.campaigns, today);

    const body: OffersResponse = {
      product: product && { sku: product.sku, name: product.name, variant: product.variant, category: product.category },
      campaign: campaign && { name: campaign.name, label: campaign.label, theme: campaign.theme, startDate: campaign.startDate, endDate: campaign.endDate },
      store: found.store,
      bank: found.bank,
      upcoming: found.upcoming,
      lastUpdated: data.lastImport ? data.lastImport.importedAt.toISOString() : null,
      hasData: data.lastImport !== null,
      today,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('GET /api/offers error:', error);
    return NextResponse.json({ error: 'Offer data could not be loaded.' }, { status: 500 });
  }
}
