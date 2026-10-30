/**
 * Tests for the offers engine (no database needed): npm run test:offers
 * Uses made-up sample data. If the real Offers Master workbook is present in shared/offer feature/,
 * it is also checked end to end (read only).
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { fromExcelSerial, offerState, parseDateCell } from '../lib/offers/dates';
import { bankOfferMatches, norm, storeOfferMatches } from '../lib/offers/match';
import { offersForProduct, runningCampaign } from '../lib/offers/engine';
import { parseOffersWorkbook } from '../lib/offers/workbook';
import { bankFilterCounts, bankGroupOf, formatInr, groupBankOffers, groupStoreOffers, storeValueLabel } from '../lib/offers/present';
import type { BankOfferData, CatalogueProduct, StoreOfferData } from '../lib/offers/types';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log('ok   -', name);
  } catch (e) {
    console.log('FAIL -', name, '\n      ', (e as Error).message.split('\n').slice(0, 4).join('\n       '));
    process.exitCode = 1;
  }
};

/* ───────── helpers: build a workbook in memory ───────── */
const STORE_H = ['Offer ID', 'Product Category', 'Product Name', 'Model / Variant', 'Storage', 'Offer Type', 'Exchange / Cashify Condition', 'Customer Category', 'Discount Type', 'Discount Value', 'Is "Up To"', 'Offer Text (as in source)', 'Eligibility', 'Combinable', 'Valid From', 'Valid Until', 'Terms and Conditions', 'Status', 'Source'];
const BANK_H = ['Offer ID', 'Bank / Partner', 'Product Category', 'Product Name', 'Model / Variant', 'Catalogue Match Type', 'Catalogue Match Text', 'Card Type', 'Offer Type', 'Cashback / Benefit Amount (₹)', 'Cashback %', 'Minimum Transaction (₹)', 'Maximum Cashback (₹)', 'EMI / Non-EMI', 'Scheme / Details (as in source)', 'Resale Value From (₹)', 'Resale Value To (₹)', 'Combinable', 'Valid From', 'Valid Until', 'Terms and Conditions', 'Status', 'Source'];
const CAMP_H = ['Campaign Name', 'Panel Label', 'Theme', 'Start Date', 'End Date', 'Active'];

const storeRow = (o: Partial<Record<string, unknown>> = {}) => {
  const d: Record<string, unknown> = { 'Offer ID': 'SO-1', 'Product Category': 'iPhone', 'Product Name': 'Phone X', 'Offer Type': 'Flat', 'Customer Category': 'All customers', 'Discount Type': 'Percent', 'Discount Value': 5, 'Is "Up To"': 'Yes', 'Offer Text (as in source)': 'UPTO 5% OFF', Combinable: 'Yes', 'Valid From': '2026-11-01', 'Valid Until': '2026-11-10', Status: 'Active', ...o };
  return STORE_H.map((h) => d[h] ?? '');
};
const bankRow = (o: Partial<Record<string, unknown>> = {}) => {
  const d: Record<string, unknown> = { 'Offer ID': 'BO-1', 'Bank / Partner': 'Bank A; Bank B; Bank C', 'Product Category': 'iPhone', 'Product Name': 'Phone X', 'Catalogue Match Type': 'Exact', 'Catalogue Match Text': 'phonex', 'Offer Type': 'Card Full Swipe Cashback', 'Cashback / Benefit Amount (₹)': 5000, 'EMI / Non-EMI': 'Non-EMI', Combinable: 'Yes', 'Valid From': '2026-10-30', Status: 'Active', ...o };
  return BANK_H.map((h) => d[h] ?? '');
};
const campRow = (o: Partial<Record<string, unknown>> = {}) => {
  const d: Record<string, unknown> = { 'Campaign Name': 'Festival', 'Panel Label': 'FESTIVAL SPECIAL', Theme: 'Diwali', 'Start Date': '2026-11-01', 'End Date': '2026-11-10', Active: 'Yes', ...o };
  return CAMP_H.map((h) => d[h] ?? '');
};
function book(sheets: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
const good = () => ({ 'Store Offers': [STORE_H, storeRow()], 'Bank Offers': [BANK_H, bankRow()], Campaign: [CAMP_H, campRow()] });
const errorsOf = (sheets: Record<string, unknown[][]>) => parseOffersWorkbook(book(sheets)).errors.map((e) => `${e.sheet}${e.row ? ' r' + e.row : ''}: ${e.message}`);

/* ───────── dates ───────── */
test('Excel serial numbers convert to the right calendar date', () => {
  assert.equal(fromExcelSerial(46327), '2026-11-01');
  assert.equal(fromExcelSerial(46336), '2026-11-10');
  assert.equal(fromExcelSerial(46325), '2026-10-30');
});
test('date cells accept the formats people actually type, and reject fakes', () => {
  for (const v of ['2026-11-14', '14-Nov-2026', '14 Nov 2026', '14/11/2026', '14.11.2026', 46340]) assert.equal(parseDateCell(v), '2026-11-14', String(v));
  for (const v of ['2026-02-30', '31/04/2026', 'tomorrow', '', '14-Foo-2026', '2026-13-01']) assert.equal(parseDateCell(v), null, String(v));
});
test('offer validity is inclusive at both ends, open-ended when no end date', () => {
  assert.equal(offerState('2026-11-01', '2026-11-10', '2026-10-31'), 'upcoming');
  assert.equal(offerState('2026-11-01', '2026-11-10', '2026-11-01'), 'active');
  assert.equal(offerState('2026-11-01', '2026-11-10', '2026-11-10'), 'active');
  assert.equal(offerState('2026-11-01', '2026-11-10', '2026-11-11'), 'expired');
  assert.equal(offerState('2026-11-01', null, '2030-01-01'), 'active');
});

/* ───────── matching ───────── */
const P = (name: string, cls: string | null, category = 'iPhone', variant: string | null = null): CatalogueProduct => ({ sku: name, name, class: cls, category, variant });
test('matching ignores capitals, spaces and symbols', () => {
  assert.equal(norm('AirPods5'), norm('Airpods 5'));
  assert.equal(norm('Watch S12 GPS'), norm('WatchS12GPS'));
  assert.equal(norm('iPhone 17e'), norm('iPhone 17 E'));
});
test('a store offer for one model never leaks onto a sibling model', () => {
  const o = { productName: 'iPhone 17', variant: null, storage: null };
  assert.equal(storeOfferMatches(o, P('iPhone 17 256GB', 'iPhone 17')), true);
  assert.equal(storeOfferMatches(o, P('iPhone 17 Pro 256GB', 'iPhone 17 Pro')), false);
  assert.equal(storeOfferMatches(o, P('iPhone 17 Pro Max', 'iPhone 17 Pro Max')), false);
  assert.equal(storeOfferMatches(o, P('iPhone 17e', 'iPhone 17 E')), false);
});
test('a product with no class falls back to its name; accessories do not match a phone offer', () => {
  assert.equal(storeOfferMatches({ productName: 'AirPods', variant: null, storage: null }, P('AIRPODS', null, 'AirPods')), true);
  assert.equal(storeOfferMatches({ productName: 'iPhone 17', variant: null, storage: null }, P('CASE iPhone 17', 'Case iPhone', 'Accessories')), false);
});
test('storage and variant narrow an offer when given', () => {
  const o = { productName: 'iPhone 17 Pro', variant: null, storage: '256GB' };
  assert.equal(storeOfferMatches(o, P('iPhone 17 Pro 256GB', 'iPhone 17 Pro', 'iPhone', '256GB')), true);
  assert.equal(storeOfferMatches(o, P('iPhone 17 Pro 512GB', 'iPhone 17 Pro', 'iPhone', '512GB')), false);
});
test('bank offers: Exact needs the same family, Contains-all needs every word', () => {
  assert.equal(bankOfferMatches({ matchType: 'Exact', matchText: 'iphone17' }, P('iPhone 17 256GB', 'iPhone 17')), true);
  assert.equal(bankOfferMatches({ matchType: 'Exact', matchText: 'iphone17' }, P('iPhone 17 Pro', 'iPhone 17 Pro')), false);
  const mba = { matchType: 'Contains all', matchText: 'macbookair; m5' };
  assert.equal(bankOfferMatches(mba, P('MacBook Air 13 M5', 'Macbook Air 13 M5', 'Mac')), true);
  assert.equal(bankOfferMatches(mba, P('MacBook Air 13 M3', 'Macbook Air 13 M3', 'Mac')), false);
  assert.equal(bankOfferMatches(mba, P('MacBook Pro 14 M5', 'Macbook Pro 14 M5', 'Mac')), false);
  assert.equal(bankOfferMatches({ matchType: 'Contains all', matchText: 'watchse3; gps' }, P('Watch SE3 GPS', 'WatchSE3GPS', 'Watch')), true);
  assert.equal(bankOfferMatches({ matchType: 'Contains all', matchText: 'watchse3; gps' }, P('Watch SE3 CELL', 'WatchSE3CELL', 'Watch')), false);
  assert.equal(bankOfferMatches({ matchType: 'Contains all', matchText: '' }, P('x', 'x')), false, 'empty rule matches nothing');
});

/* ───────── engine ───────── */
const so = (o: Partial<StoreOfferData>): StoreOfferData => ({ offerId: 'S', category: 'iPhone', productName: 'Phone X', variant: null, storage: null, offerType: 'Flat', tradeIn: null, customer: 'All customers', discountType: 'Percent', discountValue: 5, isUpTo: true, offerText: 'x', eligibility: null, combinable: true, validFrom: '2026-11-01', validUntil: '2026-11-10', terms: null, status: 'Active', source: null, ...o });
const bo = (o: Partial<BankOfferData>): BankOfferData => ({ offerId: 'B', bank: 'Bank A', category: 'iPhone', productName: 'Phone X', variant: null, matchType: 'Exact', matchText: 'phonex', cardType: null, offerType: 'Card Full Swipe Cashback', amount: 1000, percent: null, minTxn: null, maxCashback: null, emiType: 'Non-EMI', details: null, rvFrom: null, rvTo: null, combinable: true, validFrom: '2026-10-30', validUntil: null, terms: null, status: 'Active', source: null, ...o });
const phoneX = P('Phone X 256GB', 'Phone X');
test('expired, inactive and not-yet-started offers are never returned as active', () => {
  const store = [so({ offerId: 'live' }), so({ offerId: 'old', validUntil: '2026-10-01', validFrom: '2026-09-01' }), so({ offerId: 'off', status: 'Inactive' }), so({ offerId: 'soon', validFrom: '2026-12-01', validUntil: null })];
  const r = offersForProduct(phoneX, store, [], '2026-11-05');
  assert.deepEqual(r.store.map((o) => o.offerId), ['live']);
  assert.equal(r.upcoming.store, '2026-12-01');
});
test('before an offer starts: nothing active, and the start date is reported', () => {
  const r = offersForProduct(phoneX, [so({})], [bo({})], '2026-10-31');
  assert.equal(r.store.length, 0);
  assert.equal(r.upcoming.store, '2026-11-01');
  assert.equal(r.bank.length, 1, 'bank offer already started');
});
test('after the end date the offer disappears and nothing replaces it', () => {
  const r = offersForProduct(phoneX, [so({})], [bo({ validUntil: '2026-11-14' })], '2026-11-15');
  assert.equal(r.store.length + r.bank.length, 0);
  assert.equal(r.upcoming.store, null);
});
test('offers for another product are not returned', () => {
  const r = offersForProduct(P('Phone Y', 'Phone Y'), [so({})], [bo({})], '2026-11-05');
  assert.equal(r.store.length + r.bank.length, 0);
});
test('campaign window is inclusive and inactive campaigns never run', () => {
  const c = [{ name: 'D', label: 'DIWALI SPECIAL', theme: 'Diwali', startDate: '2026-11-01', endDate: '2026-11-10', active: true }];
  assert.equal(runningCampaign(c, '2026-10-31'), null);
  assert.ok(runningCampaign(c, '2026-11-01'));
  assert.ok(runningCampaign(c, '2026-11-10'));
  assert.equal(runningCampaign(c, '2026-11-11'), null);
  assert.equal(runningCampaign([{ ...c[0], active: false }], '2026-11-05'), null);
});

/* ───────── workbook parsing and validation ───────── */
test('a valid workbook parses; a multi-bank cell becomes one offer per bank', () => {
  const r = parseOffersWorkbook(book(good()));
  assert.deepEqual(r.errors, []);
  assert.equal(r.storeOffers.length, 1);
  assert.equal(r.bankRowCount, 1);
  assert.deepEqual(r.bankOffers.map((b) => b.bank), ['Bank A', 'Bank B', 'Bank C']);
  assert.equal(r.bankOffers[0].amount, 5000);
  assert.equal(r.storeOffers[0].validUntil, '2026-11-10');
  assert.equal(r.campaigns[0].theme, 'Diwali');
});
test('a blank Valid From means already started', () => {
  assert.equal(offerState(null, null, '2020-01-01'), 'active');
  assert.equal(offerState(null, '2026-11-10', '2026-11-11'), 'expired');
  const w = good();
  w['Store Offers'] = [STORE_H, storeRow({ 'Valid From': '', 'Valid Until': '' })];
  const r = parseOffersWorkbook(book(w));
  assert.deepEqual(r.errors, []);
  assert.equal(r.storeOffers[0].validFrom, null);
});

test('blank rows (the formatted empty rows below the data) are ignored', () => {
  const s = good();
  s['Store Offers'].push(STORE_H.map(() => ''), STORE_H.map((h) => (h === 'Status' ? 'Active' : h === 'Combinable' ? 'Yes' : '')));
  const r = parseOffersWorkbook(book(s));
  assert.deepEqual(r.errors, []);
  assert.equal(r.storeOffers.length, 1);
});
test('real Excel dates and a blank Valid Until (no end date) are accepted', () => {
  const s = good();
  s['Store Offers'] = [STORE_H, storeRow({ 'Valid From': 46327, 'Valid Until': '' })];
  const r = parseOffersWorkbook(book(s));
  assert.deepEqual(r.errors, []);
  assert.equal(r.storeOffers[0].validFrom, '2026-11-01');
  assert.equal(r.storeOffers[0].validUntil, null);
});
test('problems are reported with the sheet and row, and block the row', () => {
  const s = good();
  s['Store Offers'] = [STORE_H, storeRow({ 'Valid From': 'soon' }), storeRow({ 'Offer ID': 'SO-2', 'Discount Value': 150 }), storeRow({ 'Offer ID': 'SO-3', 'Valid Until': '2026-10-01' }), storeRow({ 'Offer ID': 'SO-3' }), storeRow({ 'Offer ID': 'SO-5', 'Product Category': 'Toaster' })];
  const e = errorsOf(s);
  assert.ok(e.some((x) => /Store Offers r2: Valid From "soon" is not a real date/.test(x)), e.join('\n'));
  assert.ok(e.some((x) => /r3: A Percent offer needs a Discount Value between 0 and 100/.test(x)));
  assert.ok(e.some((x) => /r4: Valid Until is before Valid From/.test(x)));
  assert.ok(e.some((x) => /r5: Offer ID "SO-3" is used more than once/.test(x)));
  assert.ok(e.some((x) => /r6: Product Category "Toaster" is not one of/.test(x)));
});
test('bank rules: amounts, scheme text and resale bands are required where they matter', () => {
  const s = good();
  s['Bank Offers'] = [BANK_H, bankRow({ 'Cashback / Benefit Amount (₹)': '' }), bankRow({ 'Offer ID': 'B2', 'Offer Type': 'Loan Scheme', 'EMI / Non-EMI': 'Loan' }), bankRow({ 'Offer ID': 'B3', 'Offer Type': 'Trade-in Top-up (TiTu)', 'EMI / Non-EMI': 'Not applicable' }), bankRow({ 'Offer ID': 'B4', 'Offer Type': 'Cashback???' })];
  const e = errorsOf(s);
  assert.ok(e.some((x) => /r2: .*needs an amount above 0/.test(x)), e.join('\n'));
  assert.ok(e.some((x) => /r3: .*Loan Scheme.*needs Scheme \/ Details/.test(x)));
  assert.ok(e.some((x) => /r4: .*needs Resale Value From/.test(x)));
  assert.ok(e.some((x) => /r5: Offer Type "Cashback\?\?\?" is not one of/.test(x)));
});
test('a missing sheet, a missing column and a bad campaign are all caught', () => {
  assert.ok(errorsOf({ 'Bank Offers': [BANK_H, bankRow()] }).some((x) => /"Store Offers" sheet is missing/.test(x)));
  const noCol = good();
  noCol['Store Offers'] = [STORE_H.filter((h) => h !== 'Status'), STORE_H.filter((h) => h !== 'Status').map(() => 'x')];
  assert.ok(errorsOf(noCol).some((x) => /Missing column "Status"/.test(x)));
  const badCamp = good();
  badCamp.Campaign = [CAMP_H, campRow({ 'Start Date': '2026-11-10', 'End Date': '2026-11-01' }), campRow({ 'Campaign Name': 'X', Theme: 'Holi' })];
  const e = errorsOf(badCamp);
  assert.ok(e.some((x) => /End Date is before Start Date/.test(x)));
  assert.ok(e.some((x) => /Theme must be Diwali or None/.test(x)));
});
test('cost and margin columns are refused, and internal working sheets are ignored with a warning', () => {
  const s: Record<string, unknown[][]> = good();
  s['Store Offers'] = [[...STORE_H, 'Cost Price'], [...storeRow(), '50,000']];
  s['iphone working'] = [['MODEL', 'Cost Price'], ['iPhone 17', '70,000']];
  const r = parseOffersWorkbook(book(s));
  assert.ok(r.errors.some((x) => /cost\/margin columns \(Cost Price\)/.test(x.message)));
  assert.ok(r.warnings.some((x) => x.sheet === 'iphone working'));
  const clean = parseOffersWorkbook(book({ ...good(), 'iphone working': [['MODEL', 'Cost Price'], ['iPhone 17', '70,000']] }));
  assert.deepEqual(clean.errors, [], 'a working sheet next to clean sheets is simply not read');
  assert.ok(!JSON.stringify(clean.storeOffers).includes('70,000'));
});
test('garbage files fail politely', () => {
  assert.ok(parseOffersWorkbook(Buffer.from('this is not a spreadsheet')).errors.length > 0);
});

/* ───────── presentation ───────── */
test('rupees use Indian grouping; percentages say "Up to" only when the source did', () => {
  assert.equal(formatInr(150000), '₹1,50,000');
  assert.equal(formatInr(7000), '₹7,000');
  assert.equal(storeValueLabel(so({ discountValue: 5, isUpTo: true })), 'Up to 5%');
  assert.equal(storeValueLabel(so({ discountValue: 7, isUpTo: false })), '7%');
  assert.equal(storeValueLabel(so({ discountType: 'Benefit (text)', discountValue: null })), null);
});
test('iPad/Mac style offers group by customer, Without Cashify before With Cashify; iPhone style stays one list', () => {
  const rows = [so({ offerId: '1', customer: 'CRT', tradeIn: 'With Cashify' }), so({ offerId: '2', customer: 'Corporate', tradeIn: 'With Cashify' }), so({ offerId: '3', customer: 'CRT', tradeIn: 'Without Cashify' }), so({ offerId: '4', customer: 'Corporate', tradeIn: 'Without Cashify' })];
  const g = groupStoreOffers(rows);
  assert.deepEqual(g.map((x) => x.title), ['Corporate', 'CRT']);
  assert.deepEqual(g[0].rows.map((r) => r.tradeIn), ['Without Cashify', 'With Cashify']);
  assert.equal(groupStoreOffers([so({}), so({ offerId: '2' })]).length, 1);
  assert.equal(groupStoreOffers([]).length, 0);
});
test('banks map to the ICICI / SBI / Axis / Others filter', () => {
  assert.equal(bankGroupOf('ICICI Bank'), 'ICICI');
  assert.equal(bankGroupOf('ICICI'), 'ICICI');
  assert.equal(bankGroupOf('SBI Card'), 'SBI');
  assert.equal(bankGroupOf('Axis Bank'), 'Axis');
  for (const b of ['Bajaj Finance', 'HDB', 'IDFC First', 'TVS Credit', 'Cashify', 'Servify']) assert.equal(bankGroupOf(b), 'Others', b);
});
test('identical offers from several banks are shown once with all the banks, and the filter narrows them', () => {
  const rows = ['Axis Bank', 'ICICI Bank', 'SBI Card'].map((bank) => bo({ bank, amount: 7000, offerType: 'Card EMI Cashback (6M No Cost EMI)' }));
  rows.push(bo({ bank: 'Bajaj Finance', offerType: 'Loan Scheme', amount: null, details: '0%-0-9; 20%-0-12', emiType: 'Loan' }));
  rows.push(bo({ bank: 'ICICI', offerType: 'Loan Scheme', amount: null, details: '0%-0-9; 20%-0-12', emiType: 'Loan' }));
  const all = groupBankOffers(rows, 'All');
  assert.deepEqual(all.map((s) => s.key), ['cashback', 'loan']);
  assert.equal(all[0].items.length, 1);
  assert.deepEqual(all[0].items[0].banks, ['Axis Bank', 'ICICI Bank', 'SBI Card']);
  assert.deepEqual(all[1].items[0].banks, ['Bajaj Finance', 'ICICI'], 'same scheme text from two lenders is one line');
  const icici = groupBankOffers(rows, 'ICICI');
  assert.deepEqual(icici[0].items[0].banks, ['ICICI Bank']);
  assert.deepEqual(groupBankOffers(rows, 'SBI').map((s) => s.key), ['cashback']);
  assert.deepEqual(groupBankOffers(rows, 'Others').map((s) => s.key), ['loan']);
  assert.deepEqual(bankFilterCounts(rows), { ICICI: 2, SBI: 1, Axis: 1, Others: 1 });
});
test('different amounts or end dates are NOT merged into one line', () => {
  const rows = [bo({ bank: 'Axis Bank', amount: 8000, validUntil: '2026-11-14' }), bo({ bank: 'ICICI Bank', amount: 7000 })];
  assert.equal(groupBankOffers(rows)[0].items.length, 2);
});

/* ───────── the real workbook, if it is here ───────── */
const real = path.join(process.cwd(), 'shared', 'offer feature', 'iPlanet_Offers_Master_Template.xlsx');
if (existsSync(real)) {
  const parsed = parseOffersWorkbook(readFileSync(real));
  const iph17pro = P('iPhone 17 Pro 256GB', 'iPhone 17 Pro');
  test('REAL FILE: parses with no errors, and the counts match the source sheets', () => {
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.storeOffers.length, 129);
    assert.equal(parsed.bankRowCount, 126);
    // 64 card rows x 3 banks + 22 loan rows x 5 lenders + 29 trade-in rows x 2 partners + 6 + 5 single-bank rows
    assert.equal(parsed.bankOffers.length, 64 * 3 + 22 * 5 + 29 * 2 + 6 + 5);
    assert.equal(parsed.campaigns.length, 1);
    assert.deepEqual(parsed.campaigns[0], { name: 'Diwali 2026', label: 'DIWALI SPECIAL', theme: 'Diwali', startDate: '2026-11-01', endDate: '2026-11-10', active: true });
  });
  test('REAL FILE: each multi-bank row became one offer per bank', () => {
    const cardRows = parsed.bankOffers.filter((b) => /Card/.test(b.offerType));
    assert.equal(cardRows.length, 64 * 3, '64 card rows x 3 banks');
    assert.deepEqual(Array.from(new Set(cardRows.map((b) => b.bank))).sort(), ['Axis Bank', 'ICICI Bank', 'SBI Card']);
  });
  test('REAL FILE: iPhone 17 Pro during Diwali (5 Nov) gets both store percentages, both specials, and the bank offers', () => {
    const r = offersForProduct(iph17pro, parsed.storeOffers, parsed.bankOffers, '2026-11-05');
    assert.deepEqual(r.store.map((o) => o.offerType).sort(), ['Special Offer 1', 'Special Offer 2', 'Unconditional Flat Off', 'With Cashify/Servify']);
    assert.equal(r.store.find((o) => o.offerType === 'Unconditional Flat Off')!.discountValue, 5);
    assert.equal(r.store.find((o) => o.offerType === 'With Cashify/Servify')!.discountValue, 3);
    // 17 Pro is not iPhone 17, so the "iPhone 17" bank offers (8K / 7K) must NOT appear for it.
    assert.equal(r.bank.filter((b) => /Card/.test(b.offerType)).length, 0, 'the deck has no cashback line for iPhone 17 Pro');
  });
  test('REAL FILE: iPhone 17 gets the enhanced cashback until 14 Nov, then it vanishes', () => {
    const p = P('iPhone 17 256GB', 'iPhone 17');
    const on14 = offersForProduct(p, parsed.storeOffers, parsed.bankOffers, '2026-11-14').bank.filter((b) => /Card EMI/.test(b.offerType));
    assert.deepEqual(Array.from(new Set(on14.map((b) => b.amount))), [8000]);
    const on15 = offersForProduct(p, parsed.storeOffers, parsed.bankOffers, '2026-11-15').bank.filter((b) => /Card/.test(b.offerType));
    assert.equal(on15.length, 0);
  });
  test('REAL FILE: store offers have no dates, so they show today and on any later day; bank offers still run', () => {
    const p = P('iPhone 17 256GB', 'iPhone 17');
    for (const day of ['2026-10-31', '2026-11-05', '2027-03-01']) {
      const r = offersForProduct(p, parsed.storeOffers, parsed.bankOffers, day);
      assert.ok(r.store.length > 0, day);
      assert.equal(r.upcoming.store, null);
    }
    assert.ok(parsed.storeOffers.every((o) => o.validFrom === null && o.validUntil === null));
  });
  test('REAL FILE: MacBook Air M5 shows Corporate and CRT store offers (with and without Cashify) and Mac bank offers', () => {
    const p = P('Macbook Air 13 M5 16GB/512GB', 'Macbook Air 13 M5', 'Mac');
    const r = offersForProduct(p, parsed.storeOffers, parsed.bankOffers, '2026-11-05');
    assert.deepEqual(r.store.map((o) => `${o.offerType}/${o.tradeIn}`).sort(), ['CRT/With Cashify', 'CRT/Without Cashify', 'Corporate/With Cashify', 'Corporate/Without Cashify']);
    assert.equal(r.store.find((o) => o.offerType === 'CRT' && o.tradeIn === 'Without Cashify')!.discountValue, 12);
    assert.ok(r.bank.some((b) => b.offerType.startsWith('Card EMI') && b.amount === 10000), 'MBA (M5) cashback 10K');
    assert.ok(!r.bank.some((b) => b.amount === 15000), 'MacBook Pro 15K must not leak onto MacBook Air');
  });
  test('REAL FILE: a Watch or AirPods product shows its single regular offer for all customers', () => {
    const w = offersForProduct(P('Watch SE3 GPS', 'WatchSE3GPS', 'Watch'), parsed.storeOffers, parsed.bankOffers, '2026-11-05');
    assert.equal(w.store.length, 1);
    assert.equal(w.store[0].customer, 'All customers');
    assert.equal(w.store[0].discountValue, 5);
  });
  test('REAL FILE: nothing from the cost or margin sheets is anywhere in the parsed data', () => {
    assert.ok(!/cost price|margin|dg support|back end/i.test(JSON.stringify([parsed.storeOffers, parsed.bankOffers])));
  });
} else {
  console.log('skip - real workbook not found (that is fine on a machine without the shared/ folder)');
}

console.log(`\n${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
