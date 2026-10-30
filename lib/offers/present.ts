/**
 * Turns matching offers into what the panels show: grouping, labels and the bank filter.
 * Wording from the source sheets is shown as written; this file only decides layout.
 */

import type { BankOfferData, StoreOfferData } from './types';

export const formatInr = (n: number): string => `₹${n.toLocaleString('en-IN')}`;

/* ───────────── store offers ───────────── */

export interface StoreGroup {
  /** Null when the offers are one flat list (e.g. an iPhone). */
  title: string | null;
  rows: StoreOfferData[];
}

/** "Up to 5%" for a percentage offer; null for a free-text benefit (its text is shown instead). */
export function storeValueLabel(o: StoreOfferData): string | null {
  if (o.discountValue === null) return null;
  const v = Number.isInteger(o.discountValue) ? String(o.discountValue) : String(o.discountValue);
  if (o.discountType === 'Percent') return `${o.isUpTo ? 'Up to ' : ''}${v}%`;
  if (o.discountType === 'Amount (₹)') return `${o.isUpTo ? 'Up to ' : ''}${formatInr(o.discountValue)}`;
  return null;
}

/**
 * iPad and Mac sheets split offers by customer (Corporate / CRT) and by Cashify, so group by customer and list
 * "Without Cashify" before "With Cashify". Everything else is a simple list in sheet order.
 */
export function groupStoreOffers(offers: StoreOfferData[]): StoreGroup[] {
  const splitByCustomer = offers.some((o) => o.tradeIn);
  if (!splitByCustomer) return offers.length ? [{ title: null, rows: offers }] : [];
  const order = ['Corporate', 'CRT'];
  const names = Array.from(new Set(offers.map((o) => o.customer))).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  const rank = (t: string | null) => (t === 'Without Cashify' ? 0 : t === 'With Cashify' ? 1 : 2);
  return names.map((n) => ({
    title: n,
    rows: offers.filter((o) => o.customer === n).sort((a, b) => rank(a.tradeIn) - rank(b.tradeIn)),
  }));
}

/* ───────────── bank offers ───────────── */

export type BankGroup = 'ICICI' | 'SBI' | 'Axis' | 'Others';
export const BANK_GROUPS: BankGroup[] = ['ICICI', 'SBI', 'Axis', 'Others'];

export function bankGroupOf(bank: string): BankGroup {
  const b = bank.toLowerCase();
  if (b.includes('icici')) return 'ICICI';
  if (b.includes('sbi')) return 'SBI';
  if (b.includes('axis')) return 'Axis';
  return 'Others';
}

/** How many offers each bank filter button would show. */
export function bankFilterCounts(offers: BankOfferData[]): Record<BankGroup, number> {
  const c: Record<BankGroup, number> = { ICICI: 0, SBI: 0, Axis: 0, Others: 0 };
  for (const o of offers) c[bankGroupOf(o.bank)]++;
  return c;
}

export interface BankItem {
  key: string;
  /** The banks / partners that share this offer, shown together instead of repeating the same line. */
  banks: string[];
  amount: number | null;
  /** Loan schemes, instalment descriptions, resale-value bands and similar, as written in the source. */
  details: string | null;
  label: string;
  validFrom: string | null;
  validUntil: string | null;
  terms: string | null;
}

export interface BankSection {
  key: 'cashback' | 'loan' | 'tradein' | 'instalment';
  title: string;
  note: string | null;
  items: BankItem[];
}

const CARD_LABEL: Record<string, string> = {
  'Card EMI Cashback (6M No Cost EMI)': 'Card EMI cashback (6-month no cost EMI)',
  'Card Full Swipe Cashback': 'Card full-payment cashback (non-EMI)',
};

/**
 * Groups the offers into sections. Offers that are identical except for the bank (the deck gives one amount
 * for Axis, ICICI and SBI together) are shown once with all their banks. `filter` keeps only the banks in
 * that group, and drops an offer with no bank left.
 */
export function groupBankOffers(offers: BankOfferData[], filter: BankGroup | 'All' = 'All'): BankSection[] {
  const kept = filter === 'All' ? offers : offers.filter((o) => bankGroupOf(o.bank) === filter);
  const merged = new Map<string, BankItem & { type: string; sort: number }>();

  kept.forEach((o, i) => {
    const key = [o.offerType, o.amount ?? '', o.details ?? '', o.rvFrom ?? '', o.rvTo ?? '', o.validFrom ?? '', o.validUntil ?? '', o.terms ?? ''].join('|');
    const hit = merged.get(key);
    if (hit) {
      if (!hit.banks.includes(o.bank)) hit.banks.push(o.bank);
      return;
    }
    merged.set(key, {
      key, type: o.offerType, sort: i, banks: [o.bank], amount: o.amount, details: o.details,
      label: CARD_LABEL[o.offerType] ?? o.offerType, validFrom: o.validFrom, validUntil: o.validUntil, terms: o.terms,
    });
  });

  const items = Array.from(merged.values()).sort((a, b) => a.sort - b.sort);
  const pick = (test: (t: string) => boolean) => items.filter((i) => test(i.type));
  const sections: BankSection[] = [
    { key: 'cashback', title: 'Card cashback', note: null, items: pick((t) => t.startsWith('Card')) },
    { key: 'loan', title: 'Loan schemes', note: 'Scheme codes are shown exactly as in the offer deck.', items: pick((t) => t === 'Loan Scheme') },
    { key: 'tradein', title: 'Trade-in top-up', note: 'Extra amount on the old device, by its resale value.', items: pick((t) => t.startsWith('Trade-in')) },
    { key: 'instalment', title: 'Instalment programmes', note: null, items: pick((t) => t === 'iPhone for Life EMI' || t === 'Easy Instalments Program') },
  ];
  return sections.filter((s) => s.items.length > 0);
}

/** Distinct, non-empty terms across a set of offers, for the "Terms and conditions" disclosure. */
export function uniqueTerms(rows: { terms: string | null; eligibility?: string | null }[]): string[] {
  return Array.from(new Set(rows.flatMap((r) => [r.terms, r.eligibility ?? null]).filter((t): t is string => !!t && t.trim() !== '')));
}
