/** Admin-side access to offers: list with ids, create, edit, delete (server only). */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { dateToIso, isoToDate, offerState } from './dates';
import { invalidateOffersCache } from './repo';
import { checkBankOffer, checkCampaign, checkStoreOffer } from './validate';
import type { BankOfferData, CampaignData, StoreOfferData } from './types';

export type OfferKind = 'store' | 'bank' | 'campaign';
export const isKind = (v: unknown): v is OfferKind => v === 'store' || v === 'bank' || v === 'campaign';

/** What the screen shows for a row: its dates decide Live / Starting later / Ended; Inactive overrides. */
export type RowState = 'live' | 'upcoming' | 'ended' | 'inactive';
const stateOf = (status: string, from: string | null, until: string | null, today: string): RowState => {
  if (status !== 'Active') return 'inactive';
  const s = offerState(from, until, today);
  return s === 'active' ? 'live' : s === 'upcoming' ? 'upcoming' : 'ended';
};

const iso = (d: Date | null) => (d ? dateToIso(d) : null);
const toDate = (s: string | null) => (s ? isoToDate(s) : null);

type StoreRow = Prisma.StoreOfferGetPayload<object>;
type BankRow = Prisma.BankOfferGetPayload<object>;
type CampaignRow = Prisma.OfferCampaignGetPayload<object>;

const storeData = (o: StoreRow): StoreOfferData => ({
  offerId: o.offerId, category: o.category, productName: o.productName, variant: o.variant, storage: o.storage, offerType: o.offerType, tradeIn: o.tradeIn,
  customer: o.customer, discountType: o.discountType, discountValue: o.discountValue, isUpTo: o.isUpTo, offerText: o.offerText, eligibility: o.eligibility,
  combinable: o.combinable, validFrom: iso(o.validFrom), validUntil: iso(o.validUntil), terms: o.terms, status: o.status, source: o.source,
});
const bankData = (o: BankRow): BankOfferData => ({
  offerId: o.offerId, bank: o.bank, category: o.category, productName: o.productName, variant: o.variant, matchType: o.matchType, matchText: o.matchText,
  cardType: o.cardType, offerType: o.offerType, amount: o.amount, percent: o.percent, minTxn: o.minTxn, maxCashback: o.maxCashback, emiType: o.emiType,
  details: o.details, rvFrom: o.rvFrom, rvTo: o.rvTo, combinable: o.combinable, validFrom: iso(o.validFrom), validUntil: iso(o.validUntil), terms: o.terms,
  status: o.status, source: o.source,
});
const campaignData = (c: CampaignRow): CampaignData => ({
  name: c.name, label: c.label, theme: c.theme, startDate: dateToIso(c.startDate), endDate: dateToIso(c.endDate), active: c.active,
});

export type AdminItem = { id: string; state: RowState; data: StoreOfferData | BankOfferData | CampaignData };

export async function listItems(kind: OfferKind, today: string): Promise<AdminItem[]> {
  if (kind === 'store') {
    const rows = await prisma.storeOffer.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((o) => ({ id: o.id, data: storeData(o), state: stateOf(o.status, iso(o.validFrom), iso(o.validUntil), today) }));
  }
  if (kind === 'bank') {
    const rows = await prisma.bankOffer.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((o) => ({ id: o.id, data: bankData(o), state: stateOf(o.status, iso(o.validFrom), iso(o.validUntil), today) }));
  }
  const rows = await prisma.offerCampaign.findMany({ orderBy: { startDate: 'asc' } });
  return rows.map((c) => ({ id: c.id, data: campaignData(c), state: !c.active ? 'inactive' : c.endDate && dateToIso(c.endDate) < today ? 'ended' : dateToIso(c.startDate) > today ? 'upcoming' : 'live' }));
}

export type WriteResult = { ok: true; id: string } | { ok: false; status: number; errors: string[] };

const duplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

export async function createItem(kind: OfferKind, raw: Record<string, unknown>): Promise<WriteResult> {
  try {
    if (kind === 'store') {
      const withId = { ...raw, offerId: String(raw.offerId ?? '').trim() || `SO-M${Date.now().toString(36).toUpperCase()}` };
      const c = checkStoreOffer(withId);
      if (!c.ok) return { ok: false, status: 400, errors: c.errors };
      const last = await prisma.storeOffer.aggregate({ _max: { sortOrder: true } });
      const d = c.data;
      const row = await prisma.storeOffer.create({
        data: { ...d, validFrom: toDate(d.validFrom), validUntil: toDate(d.validUntil), sortOrder: (last._max.sortOrder ?? 0) + 1 },
      });
      invalidateOffersCache();
      return { ok: true, id: row.id };
    }
    if (kind === 'bank') {
      const withId = { ...raw, offerId: String(raw.offerId ?? '').trim() || `BO-M${Date.now().toString(36).toUpperCase()}` };
      // Several banks can be typed at once, separated by ";", and each becomes its own row like in the workbook.
      const banks = Array.from(new Set(String(raw.bank ?? '').split(';').map((b) => b.trim()).filter(Boolean)));
      const list = banks.length ? banks : [''];
      const checked = list.map((b) => checkBankOffer({ ...withId, bank: b }));
      const bad = checked.find((c) => !c.ok);
      if (bad && !bad.ok) return { ok: false, status: 400, errors: bad.errors };
      const last = await prisma.bankOffer.aggregate({ _max: { sortOrder: true } });
      let order = (last._max.sortOrder ?? 0) + 1;
      let firstId = '';
      for (const c of checked) {
        if (!c.ok) continue;
        const d = c.data;
        const row = await prisma.bankOffer.create({ data: { ...d, validFrom: toDate(d.validFrom), validUntil: toDate(d.validUntil), sortOrder: order++ } });
        firstId ||= row.id;
      }
      invalidateOffersCache();
      return { ok: true, id: firstId };
    }
    const c = checkCampaign(raw);
    if (!c.ok) return { ok: false, status: 400, errors: c.errors };
    const d = c.data;
    const row = await prisma.offerCampaign.create({ data: { ...d, startDate: isoToDate(d.startDate), endDate: isoToDate(d.endDate) } });
    invalidateOffersCache();
    return { ok: true, id: row.id };
  } catch (e) {
    if (duplicate(e)) return { ok: false, status: 409, errors: ['An offer with this Offer ID (and bank) already exists. Use a different Offer ID.'] };
    throw e;
  }
}

/** `patch` may hold only the fields that changed; it is merged onto the stored row and the result is re-validated. */
export async function updateItem(kind: OfferKind, id: string, patch: Record<string, unknown>): Promise<WriteResult> {
  try {
    if (kind === 'store') {
      const cur = await prisma.storeOffer.findUnique({ where: { id } });
      if (!cur) return { ok: false, status: 404, errors: ['That offer no longer exists. Refresh the list.'] };
      const c = checkStoreOffer({ ...storeData(cur), ...patch });
      if (!c.ok) return { ok: false, status: 400, errors: c.errors };
      const d = c.data;
      await prisma.storeOffer.update({ where: { id }, data: { ...d, validFrom: toDate(d.validFrom), validUntil: toDate(d.validUntil) } });
    } else if (kind === 'bank') {
      const cur = await prisma.bankOffer.findUnique({ where: { id } });
      if (!cur) return { ok: false, status: 404, errors: ['That offer no longer exists. Refresh the list.'] };
      const c = checkBankOffer({ ...bankData(cur), ...patch });
      if (!c.ok) return { ok: false, status: 400, errors: c.errors };
      const d = c.data;
      await prisma.bankOffer.update({ where: { id }, data: { ...d, validFrom: toDate(d.validFrom), validUntil: toDate(d.validUntil) } });
    } else {
      const cur = await prisma.offerCampaign.findUnique({ where: { id } });
      if (!cur) return { ok: false, status: 404, errors: ['That campaign no longer exists. Refresh the list.'] };
      const c = checkCampaign({ ...campaignData(cur), ...patch });
      if (!c.ok) return { ok: false, status: 400, errors: c.errors };
      const d = c.data;
      await prisma.offerCampaign.update({ where: { id }, data: { ...d, startDate: isoToDate(d.startDate), endDate: isoToDate(d.endDate) } });
    }
    invalidateOffersCache();
    return { ok: true, id };
  } catch (e) {
    if (duplicate(e)) return { ok: false, status: 409, errors: ['Another offer already uses this Offer ID (and bank).'] };
    throw e;
  }
}

export async function deleteItem(kind: OfferKind, id: string): Promise<boolean> {
  try {
    if (kind === 'store') await prisma.storeOffer.delete({ where: { id } });
    else if (kind === 'bank') await prisma.bankOffer.delete({ where: { id } });
    else await prisma.offerCampaign.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return false;
    throw e;
  }
  invalidateOffersCache();
  return true;
}
