/** Database access for offers (server only). Everything above this file is pure and database-free. */

import { prisma } from '@/lib/prisma';
import { dateToIso, isoToDate } from './dates';
import type { Issue, ParsedWorkbook } from './workbook';
import type { BankOfferData, CampaignData, StoreOfferData } from './types';

export interface LoadedOffers {
  store: StoreOfferData[];
  bank: BankOfferData[];
  campaigns: CampaignData[];
  lastImport: { importedAt: Date; fileName: string; importedByName: string | null } | null;
}

// The three tables are small (a few hundred rows) and read on every device selection, so keep them
// in memory for a short while. An import clears it straight away on this server instance.
const CACHE_TTL_MS = 30 * 1000;
let cache: { at: number; value: LoadedOffers } | null = null;
export const invalidateOffersCache = () => {
  cache = null;
};

export async function loadAllOffers(): Promise<LoadedOffers> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  const [store, bank, campaigns, lastImport] = await Promise.all([
    prisma.storeOffer.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.bankOffer.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.offerCampaign.findMany({ orderBy: { startDate: 'asc' } }),
    prisma.offerImport.findFirst({ orderBy: { importedAt: 'desc' } }),
  ]);

  const value: LoadedOffers = {
    store: store.map((o) => ({
      offerId: o.offerId, category: o.category, productName: o.productName, variant: o.variant, storage: o.storage, offerType: o.offerType,
      tradeIn: o.tradeIn, customer: o.customer, discountType: o.discountType, discountValue: o.discountValue, isUpTo: o.isUpTo, offerText: o.offerText,
      eligibility: o.eligibility, combinable: o.combinable, validFrom: o.validFrom ? dateToIso(o.validFrom) : null, validUntil: o.validUntil ? dateToIso(o.validUntil) : null,
      terms: o.terms, status: o.status, source: o.source,
    })),
    bank: bank.map((o) => ({
      offerId: o.offerId, bank: o.bank, category: o.category, productName: o.productName, variant: o.variant, matchType: o.matchType, matchText: o.matchText,
      cardType: o.cardType, offerType: o.offerType, amount: o.amount, percent: o.percent, minTxn: o.minTxn, maxCashback: o.maxCashback, emiType: o.emiType,
      details: o.details, rvFrom: o.rvFrom, rvTo: o.rvTo, combinable: o.combinable, validFrom: o.validFrom ? dateToIso(o.validFrom) : null,
      validUntil: o.validUntil ? dateToIso(o.validUntil) : null, terms: o.terms, status: o.status, source: o.source,
    })),
    campaigns: campaigns.map((c) => ({ name: c.name, label: c.label, theme: c.theme, startDate: dateToIso(c.startDate), endDate: dateToIso(c.endDate), active: c.active })),
    lastImport: lastImport ? { importedAt: lastImport.importedAt, fileName: lastImport.fileName, importedByName: lastImport.importedByName } : null,
  };
  cache = { at: Date.now(), value };
  return value;
}

/**
 * Replaces ALL offers with the contents of the workbook, in one transaction: either the whole new set
 * is in place or the old one is untouched. The workbook is the master, so rows missing from it are removed.
 */
export async function replaceAllOffers(
  parsed: ParsedWorkbook,
  by: { id: string; name: string },
  fileName: string,
  warnings: Issue[]
) {
  await prisma.$transaction(
    async (tx) => {
      await tx.storeOffer.deleteMany({});
      await tx.bankOffer.deleteMany({});
      await tx.offerCampaign.deleteMany({});

      await tx.storeOffer.createMany({
        data: parsed.storeOffers.map((o, i) => ({
          offerId: o.offerId, category: o.category, productName: o.productName, variant: o.variant, storage: o.storage, offerType: o.offerType, tradeIn: o.tradeIn,
          customer: o.customer, discountType: o.discountType, discountValue: o.discountValue, isUpTo: o.isUpTo, offerText: o.offerText, eligibility: o.eligibility,
          combinable: o.combinable, validFrom: o.validFrom ? isoToDate(o.validFrom) : null, validUntil: o.validUntil ? isoToDate(o.validUntil) : null, terms: o.terms, status: o.status,
          source: o.source, sortOrder: i,
        })),
      });
      await tx.bankOffer.createMany({
        data: parsed.bankOffers.map((o, i) => ({
          offerId: o.offerId, bank: o.bank, category: o.category, productName: o.productName, variant: o.variant, matchType: o.matchType, matchText: o.matchText,
          cardType: o.cardType, offerType: o.offerType, amount: o.amount, percent: o.percent, minTxn: o.minTxn, maxCashback: o.maxCashback, emiType: o.emiType,
          details: o.details, rvFrom: o.rvFrom, rvTo: o.rvTo, combinable: o.combinable, validFrom: o.validFrom ? isoToDate(o.validFrom) : null,
          validUntil: o.validUntil ? isoToDate(o.validUntil) : null, terms: o.terms, status: o.status, source: o.source, sortOrder: i,
        })),
      });
      await tx.offerCampaign.createMany({
        data: parsed.campaigns.map((c) => ({ name: c.name, label: c.label, theme: c.theme, startDate: isoToDate(c.startDate), endDate: isoToDate(c.endDate), active: c.active })),
      });
      await tx.offerImport.create({
        data: {
          fileName: fileName.slice(0, 200), importedById: by.id, importedByName: by.name, storeCount: parsed.storeOffers.length,
          bankCount: parsed.bankOffers.length, campaignCount: parsed.campaigns.length, warnings: warnings.length ? JSON.stringify(warnings.slice(0, 50)) : null,
        },
      });
    },
    { maxWait: 10000, timeout: 60000 }
  );
  invalidateOffersCache();
}
