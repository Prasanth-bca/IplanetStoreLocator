/**
 * Validation for offers added or edited by hand in the admin screen. It applies the same rules as the Excel
 * importer, so an offer is accepted here only if the same row would be accepted in the workbook.
 * Pure: no database access.
 */

import { isRealDate } from './dates';
import { BANK_OFFER_TYPES, EMI_TYPES, MATCH_TYPES, OFFER_CATEGORIES, STORE_DISCOUNT_TYPES, THEMES } from './types';
import type { BankOfferData, CampaignData, StoreOfferData } from './types';

const text = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();
const textOrNull = (v: unknown): string | null => text(v) || null;
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined => list.find((x) => x.toLowerCase() === text(v).toLowerCase());

/** "", null and undefined are blank; anything else must be a finite number. Returns undefined for a bad number. */
function num(v: unknown): number | null | undefined {
  if (v === null || v === undefined || text(v) === '') return null;
  const n = typeof v === 'number' ? v : Number(text(v).replace(/[₹,%\s]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function isoDate(v: unknown): string | null | undefined {
  const s = text(v);
  if (s === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m || !isRealDate(+m[1], +m[2], +m[3])) return undefined;
  return s;
}

const bool = (v: unknown, fallback: boolean): boolean | undefined => {
  if (v === null || v === undefined || text(v) === '') return fallback;
  if (typeof v === 'boolean') return v;
  const s = text(v).toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(s)) return true;
  if (['no', 'n', 'false', '0'].includes(s)) return false;
  return undefined;
};

export type Checked<T> = { ok: true; data: T } | { ok: false; errors: string[] };

export function checkStoreOffer(raw: Record<string, unknown>): Checked<StoreOfferData> {
  const errors: string[] = [];
  const E = (m: string) => errors.push(m);

  const offerId = text(raw.offerId);
  if (!offerId) E('Offer ID is required.');
  const category = oneOf(OFFER_CATEGORIES, raw.category);
  if (!category) E(`Product Category must be one of: ${OFFER_CATEGORIES.join(', ')}.`);
  if (!text(raw.productName)) E('Product Name is required.');
  if (!text(raw.offerType)) E('Offer Type is required.');
  if (!text(raw.customer)) E('Customer Category is required.');
  if (!text(raw.offerText)) E('Offer Text is required.');
  const discountType = oneOf(STORE_DISCOUNT_TYPES, raw.discountType);
  if (!discountType) E(`Discount Type must be one of: ${STORE_DISCOUNT_TYPES.join(', ')}.`);

  const value = num(raw.discountValue);
  if (value === undefined) E('Discount Value must be a number (no ₹ or % sign needed).');
  if (discountType === 'Percent' && !(typeof value === 'number' && value > 0 && value <= 100)) E('A Percent offer needs a Discount Value between 0 and 100.');
  if (discountType === 'Amount (₹)' && !(typeof value === 'number' && value > 0)) E('An Amount offer needs a Discount Value above 0.');

  const upTo = text(raw.isUpTo) === '' ? null : bool(raw.isUpTo, true);
  if (upTo === undefined) E('Is "Up To" must be Yes or No.');
  const combinable = bool(raw.combinable, true);
  if (combinable === undefined) E('Combinable must be Yes or No.');

  const validFrom = isoDate(raw.validFrom);
  if (validFrom === undefined) E('Valid From is not a real date.');
  const validUntil = isoDate(raw.validUntil);
  if (validUntil === undefined) E('Valid Until is not a real date.');
  if (validFrom && validUntil && validUntil < validFrom) E('Valid Until is before Valid From.');
  const status = oneOf(['Active', 'Inactive'] as const, raw.status ?? 'Active');
  if (!status) E('Status must be Active or Inactive.');

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: {
      offerId, category: category!, productName: text(raw.productName), variant: textOrNull(raw.variant), storage: textOrNull(raw.storage),
      offerType: text(raw.offerType), tradeIn: textOrNull(raw.tradeIn), customer: text(raw.customer), discountType: discountType!,
      discountValue: typeof value === 'number' ? value : null, isUpTo: upTo as boolean | null, offerText: text(raw.offerText),
      eligibility: textOrNull(raw.eligibility), combinable: combinable!, validFrom: validFrom ?? null, validUntil: validUntil ?? null,
      terms: textOrNull(raw.terms), status: status!, source: textOrNull(raw.source),
    },
  };
}

export function checkBankOffer(raw: Record<string, unknown>): Checked<BankOfferData> {
  const errors: string[] = [];
  const E = (m: string) => errors.push(m);

  const offerId = text(raw.offerId);
  if (!offerId) E('Offer ID is required.');
  if (!text(raw.bank)) E('Bank / Partner is required.');
  const category = oneOf(OFFER_CATEGORIES, raw.category);
  if (!category) E(`Product Category must be one of: ${OFFER_CATEGORIES.join(', ')}.`);
  if (!text(raw.productName)) E('Product Name is required.');
  const matchType = oneOf(MATCH_TYPES, raw.matchType);
  if (!matchType) E('Catalogue Match Type must be Exact or Contains all.');
  if (!text(raw.matchText)) E('Catalogue Match Text is required (it decides which products get this offer).');
  const offerType = oneOf(BANK_OFFER_TYPES, raw.offerType);
  if (!offerType) E(`Offer Type must be one of: ${BANK_OFFER_TYPES.join('; ')}.`);
  const emiType = oneOf(EMI_TYPES, raw.emiType);
  if (!emiType) E(`EMI / Non-EMI must be one of: ${EMI_TYPES.join(', ')}.`);

  const label: Record<string, string> = { amount: 'Cashback / Benefit Amount', percent: 'Cashback %', minTxn: 'Minimum Transaction', maxCashback: 'Maximum Cashback', rvFrom: 'Resale Value From', rvTo: 'Resale Value To' };
  const n: Record<string, number | null> = {};
  for (const f of Object.keys(label)) {
    const v = num(raw[f]);
    if (v === undefined) E(`${label[f]} must be a number.`);
    else n[f] = v;
  }
  if (offerType && /Cashback|Top-up/.test(offerType) && !(typeof n.amount === 'number' && n.amount > 0)) E(`A "${offerType}" offer needs an amount above 0.`);
  if (offerType && /Loan|iPhone for Life|Easy/.test(offerType) && !text(raw.details)) E(`A "${offerType}" offer needs Scheme / Details.`);
  if (offerType && /Top-up/.test(offerType) && n.rvFrom === null) E('A trade-in top-up needs Resale Value From.');
  if (typeof n.rvFrom === 'number' && typeof n.rvTo === 'number' && n.rvTo < n.rvFrom) E('Resale Value To is below Resale Value From.');

  const validFrom = isoDate(raw.validFrom);
  if (validFrom === undefined) E('Valid From is not a real date.');
  const validUntil = isoDate(raw.validUntil);
  if (validUntil === undefined) E('Valid Until is not a real date.');
  if (validFrom && validUntil && validUntil < validFrom) E('Valid Until is before Valid From.');
  const status = oneOf(['Active', 'Inactive'] as const, raw.status ?? 'Active');
  if (!status) E('Status must be Active or Inactive.');
  const combinable = bool(raw.combinable, true);
  if (combinable === undefined) E('Combinable must be Yes or No.');

  if (errors.length) return { ok: false, errors };
  const int = (v: number | null) => (v === null ? null : Math.round(v));
  return {
    ok: true,
    data: {
      offerId, bank: text(raw.bank), category: category!, productName: text(raw.productName), variant: textOrNull(raw.variant), matchType: matchType!,
      matchText: text(raw.matchText), cardType: textOrNull(raw.cardType), offerType: offerType!, amount: int(n.amount), percent: n.percent,
      minTxn: int(n.minTxn), maxCashback: int(n.maxCashback), emiType: emiType!, details: textOrNull(raw.details), rvFrom: int(n.rvFrom), rvTo: int(n.rvTo),
      combinable: combinable!, validFrom: validFrom ?? null, validUntil: validUntil ?? null, terms: textOrNull(raw.terms), status: status!, source: textOrNull(raw.source),
    },
  };
}

export function checkCampaign(raw: Record<string, unknown>): Checked<CampaignData> {
  const errors: string[] = [];
  const name = text(raw.name);
  if (!name) errors.push('Campaign Name is required.');
  const theme = oneOf(THEMES, raw.theme ?? 'None');
  if (!theme) errors.push('Theme must be Diwali or None.');
  const start = isoDate(raw.startDate);
  const end = isoDate(raw.endDate);
  if (!start) errors.push('Start Date is required and must be a real date.');
  if (!end) errors.push('End Date is required and must be a real date.');
  if (start && end && end < start) errors.push('End Date is before Start Date.');
  const active = bool(raw.active, true);
  if (active === undefined) errors.push('Active must be Yes or No.');
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { name, label: text(raw.label), theme: theme!, startDate: start!, endDate: end!, active: active! } };
}
