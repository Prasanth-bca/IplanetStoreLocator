/**
 * Reads and validates the Offers Master workbook ("Store Offers", "Bank Offers" and "Campaign" sheets).
 * Nothing is trusted: every row is checked, and problems are reported with sheet, row and column so an
 * administrator can fix the file. Pure code (no database), so it can be tested on its own.
 */

import * as XLSX from 'xlsx';
import { parseDateCell } from './dates';
import {
  BANK_OFFER_TYPES,
  BankOfferData,
  CampaignData,
  EMI_TYPES,
  MATCH_TYPES,
  OFFER_CATEGORIES,
  STORE_DISCOUNT_TYPES,
  StoreOfferData,
  THEMES,
} from './types';

export interface Issue {
  sheet: string;
  /** Spreadsheet row number as shown in Excel (the header is row 1). */
  row?: number;
  message: string;
}

export interface ParsedWorkbook {
  campaigns: CampaignData[];
  storeOffers: StoreOfferData[];
  bankOffers: BankOfferData[];
  /** Offer rows in the file, before a multi-bank cell is split into one offer per bank. */
  bankRowCount: number;
  errors: Issue[];
  warnings: Issue[];
}

const MAX_ISSUES = 200;
const key = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Canonical field name -> accepted header texts (compared ignoring case and symbols).
const STORE_HEADERS: Record<string, string[]> = {
  offerId: ['Offer ID'], category: ['Product Category'], productName: ['Product Name'], variant: ['Model / Variant'],
  storage: ['Storage'], offerType: ['Offer Type'], tradeIn: ['Exchange / Cashify Condition'], customer: ['Customer Category'],
  discountType: ['Discount Type'], discountValue: ['Discount Value'], isUpTo: ['Is "Up To"'], offerText: ['Offer Text (as in source)'],
  eligibility: ['Eligibility'], combinable: ['Combinable'], validFrom: ['Valid From'], validUntil: ['Valid Until'],
  terms: ['Terms and Conditions'], status: ['Status'], source: ['Source'],
};
const BANK_HEADERS: Record<string, string[]> = {
  offerId: ['Offer ID'], banks: ['Bank / Partner'], category: ['Product Category'], productName: ['Product Name'], variant: ['Model / Variant'],
  matchType: ['Catalogue Match Type'], matchText: ['Catalogue Match Text'], cardType: ['Card Type'], offerType: ['Offer Type'],
  amount: ['Cashback / Benefit Amount (₹)'], percent: ['Cashback %'], minTxn: ['Minimum Transaction (₹)'], maxCashback: ['Maximum Cashback (₹)'],
  emiType: ['EMI / Non-EMI'], details: ['Scheme / Details (as in source)'], rvFrom: ['Resale Value From (₹)'], rvTo: ['Resale Value To (₹)'],
  combinable: ['Combinable'], validFrom: ['Valid From'], validUntil: ['Valid Until'], terms: ['Terms and Conditions'], status: ['Status'], source: ['Source'],
};
const CAMPAIGN_HEADERS: Record<string, string[]> = {
  name: ['Campaign Name'], label: ['Panel Label'], theme: ['Theme'], startDate: ['Start Date'], endDate: ['End Date'], active: ['Active'],
};

/** Column order for each sheet, used by the exporter so a downloaded file can be edited and re-imported. */
export const SHEET_COLUMNS = {
  store: Object.entries(STORE_HEADERS).map(([field, [header]]) => ({ field, header })),
  bank: Object.entries(BANK_HEADERS).map(([field, [header]]) => ({ field, header })),
  campaign: Object.entries(CAMPAIGN_HEADERS).map(([field, [header]]) => ({ field, header })),
};

const STORE_REQUIRED = ['offerId', 'category', 'productName', 'offerType', 'customer', 'discountType', 'offerText', 'status'];
const BANK_REQUIRED = ['offerId', 'banks', 'category', 'productName', 'matchType', 'matchText', 'offerType', 'emiType', 'status'];

type Row = Record<string, unknown>;

/** Maps each sheet column to a field name using the header row. Reports required columns that are missing. */
function readSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  headers: Record<string, string[]>,
  required: string[],
  errors: Issue[]
): { rows: { row: number; data: Row }[]; found: boolean } {
  const actual = wb.SheetNames.find((n) => key(n) === key(sheetName));
  if (!actual) return { rows: [], found: false };

  const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[actual], { header: 1, defval: '', blankrows: true, raw: true });
  const headerRow = grid[0] ?? [];
  const colOf: Record<string, number> = {};
  for (const [field, names] of Object.entries(headers)) {
    const idx = headerRow.findIndex((h) => names.some((n) => key(n) === key(h)));
    if (idx >= 0) colOf[field] = idx;
  }
  for (const field of required) {
    if (!(field in colOf)) errors.push({ sheet: sheetName, message: `Missing column "${headers[field][0]}" in the header row.` });
  }
  // Guard: this file must never carry cost or margin data into the app.
  const confidential = headerRow.map((h) => String(h)).filter((h) => /cost\s*price|margin|dg\s*support|back\s*end/i.test(h));
  if (confidential.length) {
    errors.push({ sheet: sheetName, message: `This sheet has cost/margin columns (${confidential.join(', ')}). Remove them before importing; they must never be uploaded.` });
  }

  const rows: { row: number; data: Row }[] = [];
  grid.slice(1).forEach((cells, i) => {
    const data: Row = {};
    for (const [field, idx] of Object.entries(colOf)) data[field] = cells[idx] ?? '';
    // A row counts only if something other than a status/combinable default is filled in.
    const meaningful = Object.entries(data).some(([f, v]) => !['status', 'combinable', 'active'].includes(f) && String(v).trim() !== '');
    if (meaningful) rows.push({ row: i + 2, data });
  });
  return { rows, found: true };
}

const text = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();
const textOrNull = (v: unknown): string | null => text(v) || null;

function numberOrNull(v: unknown): number | null | undefined {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const n = Number(String(v).replace(/[₹,%\s]/g, '').replace(/,/g, ''));
  return String(v).trim() === '' ? null : Number.isFinite(n) ? n : undefined; // undefined = not a number
}

const yesNo = (v: unknown): boolean | undefined => {
  const t = text(v).toLowerCase();
  if (t === '') return undefined;
  if (['yes', 'y', 'true', '1'].includes(t)) return true;
  if (['no', 'n', 'false', '0'].includes(t)) return false;
  return undefined;
};

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined => list.find((x) => x.toLowerCase() === text(v).toLowerCase());

export function parseOffersWorkbook(buffer: ArrayBuffer | Buffer): ParsedWorkbook {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const result: ParsedWorkbook = { campaigns: [], storeOffers: [], bankOffers: [], bankRowCount: 0, errors, warnings };

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: Buffer.isBuffer(buffer) ? 'buffer' : 'array', cellDates: false });
  } catch {
    errors.push({ sheet: '(file)', message: 'This file could not be read as an Excel workbook.' });
    return result;
  }

  const add = (list: Issue[], sheet: string, row: number | undefined, message: string) => {
    if (list.length < MAX_ISSUES) list.push({ sheet, row, message });
  };

  // Sheets that are ignored on purpose; flag the ones that look like confidential working sheets.
  const known = ['Store Offers', 'Bank Offers', 'Campaign'];
  for (const name of wb.SheetNames) {
    if (known.some((k) => key(k) === key(name))) continue;
    if (/working|cost|margin/i.test(name)) warnings.push({ sheet: name, message: 'Ignored. This looks like an internal working sheet; it is not read or stored.' });
  }

  /* ───────── Store Offers ───────── */
  const store = readSheet(wb, 'Store Offers', STORE_HEADERS, STORE_REQUIRED, errors);
  if (!store.found) errors.push({ sheet: 'Store Offers', message: 'The "Store Offers" sheet is missing.' });
  const seenStore = new Set<string>();
  store.rows.forEach(({ row, data }) => {
    let bad = false;
    const E = (m: string) => { bad = true; add(errors, 'Store Offers', row, m); };
    for (const f of STORE_REQUIRED) if (f in data && text(data[f]) === '') E(`${STORE_HEADERS[f][0]} is required.`);

    const offerId = text(data.offerId);
    if (offerId) {
      if (seenStore.has(offerId.toLowerCase())) E(`Offer ID "${offerId}" is used more than once.`);
      seenStore.add(offerId.toLowerCase());
    }
    const category = oneOf(OFFER_CATEGORIES, data.category);
    if (text(data.category) && !category) E(`Product Category "${text(data.category)}" is not one of: ${OFFER_CATEGORIES.join(', ')}.`);
    const discountType = oneOf(STORE_DISCOUNT_TYPES, data.discountType);
    if (text(data.discountType) && !discountType) E(`Discount Type "${text(data.discountType)}" is not one of: ${STORE_DISCOUNT_TYPES.join(', ')}.`);

    const value = numberOrNull(data.discountValue);
    if (value === undefined) E('Discount Value must be a number (no ₹ or % sign needed).');
    if (discountType === 'Percent' && !(typeof value === 'number' && value > 0 && value <= 100)) E('A Percent offer needs a Discount Value between 0 and 100.');
    if (discountType === 'Amount (₹)' && !(typeof value === 'number' && value > 0)) E('An Amount offer needs a Discount Value above 0.');

    const validFrom = parseDateCell(data.validFrom);
    if (text(data.validFrom) && !validFrom) E(`Valid From "${text(data.validFrom)}" is not a real date.`);
    const untilRaw = data.validUntil;
    const validUntil = text(untilRaw) === '' ? null : parseDateCell(untilRaw);
    if (text(untilRaw) !== '' && !validUntil) E(`Valid Until "${text(untilRaw)}" is not a real date.`);
    if (validFrom && validUntil && validUntil < validFrom) E('Valid Until is before Valid From.');

    const status = oneOf(['Active', 'Inactive'] as const, data.status);
    if (text(data.status) && !status) E(`Status must be Active or Inactive, not "${text(data.status)}".`);
    const combinable = text(data.combinable) === '' ? true : yesNo(data.combinable);
    if (combinable === undefined) E('Combinable must be Yes or No.');
    const upToRaw = yesNo(data.isUpTo);
    if (text(data.isUpTo) !== '' && upToRaw === undefined) E('Is "Up To" must be Yes or No.');

    if (bad) return;
    result.storeOffers.push({
      offerId, category: category!, productName: text(data.productName), variant: textOrNull(data.variant), storage: textOrNull(data.storage),
      offerType: text(data.offerType), tradeIn: textOrNull(data.tradeIn), customer: text(data.customer), discountType: discountType!,
      discountValue: typeof value === 'number' ? value : null, isUpTo: text(data.isUpTo) === '' ? null : upToRaw!, offerText: text(data.offerText),
      eligibility: textOrNull(data.eligibility), combinable: combinable!, validFrom, validUntil, terms: textOrNull(data.terms),
      status: status!, source: textOrNull(data.source),
    });
  });

  /* ───────── Bank Offers ───────── */
  const bank = readSheet(wb, 'Bank Offers', BANK_HEADERS, BANK_REQUIRED, errors);
  if (!bank.found) errors.push({ sheet: 'Bank Offers', message: 'The "Bank Offers" sheet is missing.' });
  result.bankRowCount = bank.rows.length;
  const seenBank = new Set<string>();
  bank.rows.forEach(({ row, data }) => {
    let bad = false;
    const E = (m: string) => { bad = true; add(errors, 'Bank Offers', row, m); };
    for (const f of BANK_REQUIRED) if (f in data && text(data[f]) === '') E(`${BANK_HEADERS[f][0]} is required.`);

    const offerId = text(data.offerId);
    const banks = Array.from(new Set(String(data.banks ?? '').split(';').map(text).filter(Boolean)));
    const category = oneOf(OFFER_CATEGORIES, data.category);
    if (text(data.category) && !category) E(`Product Category "${text(data.category)}" is not one of: ${OFFER_CATEGORIES.join(', ')}.`);
    const offerType = oneOf(BANK_OFFER_TYPES, data.offerType);
    if (text(data.offerType) && !offerType) E(`Offer Type "${text(data.offerType)}" is not one of: ${BANK_OFFER_TYPES.join('; ')}.`);
    const matchType = oneOf(MATCH_TYPES, data.matchType);
    if (text(data.matchType) && !matchType) E(`Catalogue Match Type must be Exact or Contains all, not "${text(data.matchType)}".`);
    const emiType = oneOf(EMI_TYPES, data.emiType);
    if (text(data.emiType) && !emiType) E(`EMI / Non-EMI must be one of: ${EMI_TYPES.join(', ')}.`);

    const nums: Record<string, number | null> = {};
    for (const f of ['amount', 'percent', 'minTxn', 'maxCashback', 'rvFrom', 'rvTo']) {
      const n = numberOrNull(data[f]);
      if (n === undefined) E(`${BANK_HEADERS[f][0]} must be a number.`);
      else nums[f] = n;
    }
    if (offerType && /Cashback|Top-up/.test(offerType) && !(typeof nums.amount === 'number' && nums.amount > 0)) E(`A "${offerType}" offer needs an amount above 0.`);
    if (offerType && /Loan|iPhone for Life|Easy/.test(offerType) && !text(data.details)) E(`A "${offerType}" offer needs Scheme / Details.`);
    if (offerType && /Top-up/.test(offerType) && nums.rvFrom === null) E('A trade-in top-up needs Resale Value From.');
    if (typeof nums.rvFrom === 'number' && typeof nums.rvTo === 'number' && nums.rvTo < nums.rvFrom) E('Resale Value To is below Resale Value From.');

    const validFrom = parseDateCell(data.validFrom);
    if (text(data.validFrom) && !validFrom) E(`Valid From "${text(data.validFrom)}" is not a real date.`);
    const validUntil = text(data.validUntil) === '' ? null : parseDateCell(data.validUntil);
    if (text(data.validUntil) !== '' && !validUntil) E(`Valid Until "${text(data.validUntil)}" is not a real date.`);
    if (validFrom && validUntil && validUntil < validFrom) E('Valid Until is before Valid From.');
    const status = oneOf(['Active', 'Inactive'] as const, data.status);
    if (text(data.status) && !status) E(`Status must be Active or Inactive, not "${text(data.status)}".`);
    const combinable = text(data.combinable) === '' ? true : yesNo(data.combinable);
    if (combinable === undefined) E('Combinable must be Yes or No.');
    if (text(data.banks) && banks.length === 0) E('Bank / Partner has no usable name.');

    for (const b of banks) {
      const k = `${offerId.toLowerCase()}|${b.toLowerCase()}`;
      if (offerId && seenBank.has(k)) E(`Offer ID "${offerId}" is used more than once for ${b}.`);
      seenBank.add(k);
    }
    if (bad) return;

    banks.forEach((b) =>
      result.bankOffers.push({
        offerId, bank: b, category: category!, productName: text(data.productName), variant: textOrNull(data.variant), matchType: matchType!,
        matchText: text(data.matchText), cardType: textOrNull(data.cardType), offerType: offerType!, amount: nums.amount, percent: nums.percent,
        minTxn: nums.minTxn, maxCashback: nums.maxCashback, emiType: emiType!, details: textOrNull(data.details), rvFrom: nums.rvFrom, rvTo: nums.rvTo,
        combinable: combinable!, validFrom, validUntil, terms: textOrNull(data.terms), status: status!, source: textOrNull(data.source),
      })
    );
  });

  /* ───────── Campaign ───────── */
  const camp = readSheet(wb, 'Campaign', CAMPAIGN_HEADERS, ['name', 'startDate', 'endDate'], errors);
  if (!camp.found) warnings.push({ sheet: 'Campaign', message: 'No "Campaign" sheet, so no festive label or styling will be shown.' });
  camp.rows.forEach(({ row, data }) => {
    let bad = false;
    const E = (m: string) => { bad = true; add(errors, 'Campaign', row, m); };
    for (const f of ['name', 'startDate', 'endDate']) if (text(data[f]) === '') E(`${CAMPAIGN_HEADERS[f][0]} is required.`);
    const start = parseDateCell(data.startDate);
    const end = parseDateCell(data.endDate);
    if (text(data.startDate) && !start) E(`Start Date "${text(data.startDate)}" is not a real date.`);
    if (text(data.endDate) && !end) E(`End Date "${text(data.endDate)}" is not a real date.`);
    if (start && end && end < start) E('End Date is before Start Date.');
    const theme = text(data.theme) === '' ? 'None' : oneOf(THEMES, data.theme);
    if (!theme) E(`Theme must be Diwali or None, not "${text(data.theme)}".`);
    const active = text(data.active) === '' ? true : yesNo(data.active);
    if (active === undefined) E('Active must be Yes or No.');
    if (bad) return;
    result.campaigns.push({ name: text(data.name), label: text(data.label), theme: theme!, startDate: start!, endDate: end!, active: active! });
  });

  return result;
}
