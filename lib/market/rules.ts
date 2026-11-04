/**
 * Market Price & Offers: pure rules (no database, no network) shared by the server routes, the pages and the tests.
 *
 * Nothing here knows a price. Every price comes from a row somebody or some feed saved with a source link and a time;
 * these functions only decide how to present, rank and compare them honestly.
 */

export const PLATFORMS = [
  { id: 'AMAZON', label: 'Amazon India', search: 'https://www.amazon.in/s?k=' },
  { id: 'FLIPKART', label: 'Flipkart', search: 'https://www.flipkart.com/search?q=' },
  { id: 'CROMA', label: 'Croma', search: 'https://www.croma.com/searchB?q=' },
  { id: 'RELIANCE', label: 'Reliance Digital', search: 'https://www.reliancedigital.in/search?q=' },
  { id: 'VIJAY', label: 'Vijay Sales', search: 'https://www.vijaysales.com/search/' },
  { id: 'APPLE', label: 'Apple India', search: 'https://www.apple.com/in/search/' },
  { id: 'OTHER', label: 'Other authorised retailer', search: '' },
] as const;
export type PlatformId = (typeof PLATFORMS)[number]['id'];
export const PLATFORM_IDS: readonly string[] = PLATFORMS.map((p) => p.id);
export const platformLabel = (id: string) => PLATFORMS.find((p) => p.id === id)?.label ?? id;
export const platformSearchUrl = (id: string, query: string) => {
  const p = PLATFORMS.find((x) => x.id === id);
  return p && p.search ? `${p.search}${encodeURIComponent(query)}` : null;
};

export const CATEGORIES = ['iPhone', 'MacBook', 'iPad', 'Apple Watch', 'AirPods', 'iMac', 'Accessories'] as const;
export const OFFER_KINDS = ['BANK', 'EXCHANGE', 'NO_COST_EMI', 'OTHER'] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];
export const OFFER_KIND_LABEL: Record<OfferKind, string> = { BANK: 'Bank / card offer', EXCHANGE: 'Exchange offer', NO_COST_EMI: 'No-cost EMI', OTHER: 'Other offer' };
export const AVAILABILITY = ['IN_STOCK', 'OUT_OF_STOCK', 'UNKNOWN'] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** A price older than this is shown, but marked old and never counted as "lowest". */
export const STALE_HOURS = 72;
export const PRICE_MIN = 500;
export const PRICE_MAX = 3_000_000;

/* ───────────── product identity ───────────── */

/**
 * The identity of an exact product + variant: "iPhone 17 Pro 256 GB" and "iphone 17 pro 256gb" are the same,
 * "iPhone 17 Pro 512GB" and "iPhone 17 Pro Max 256GB" are different. Two rows are only ever compared when this matches.
 */
export function productKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/(\d)\s*(gb|tb)\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function guessCategory(label: string): string {
  const s = label.toLowerCase();
  if (/iphone/.test(s)) return 'iPhone';
  if (/macbook/.test(s)) return 'MacBook';
  if (/ipad/.test(s)) return 'iPad';
  if (/watch/.test(s)) return 'Apple Watch';
  if (/airpods|earpods/.test(s)) return 'AirPods';
  if (/imac|mac mini|mac studio/.test(s)) return 'iMac';
  return 'Accessories';
}

/** Every word of the query must appear in the label (storage like "256 gb" is normalised first). */
export function matchesQuery(label: string, query: string): boolean {
  const norm = (t: string) => t.toLowerCase().replace(/(\d)\s*(gb|tb)\b/g, '$1$2');
  const hay = norm(label);
  const words = norm(query).split(/[\s/,-]+/).filter(Boolean);
  return words.length > 0 && words.every((w) => hay.includes(w));
}

/* ───────────── validation of a saved price ───────────── */

export interface OfferInput {
  kind: OfferKind;
  title: string;
  bank: string | null;
  discountAmount: number | null;
  discountPercent: number | null;
  minAmount: number | null;
  maxDiscount: number | null;
  validFrom: string | null;
  validUntil: string | null;
  variants: string | null;
  terms: string | null;
  link: string | null;
}
export interface PriceInput {
  productLabel: string;
  category: string;
  platform: PlatformId;
  retailerName: string | null;
  mrp: number | null;
  sellingPrice: number;
  availability: Availability;
  sourceUrl: string;
  offers: OfferInput[];
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const optInt = (v: unknown): number | null | 'bad' => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,₹\s]/g, ''));
  return Number.isInteger(n) && n >= 0 ? n : 'bad';
};
export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
const optDate = (v: unknown): string | null | 'bad' => {
  if (v === null || v === undefined || v === '') return null;
  const t = Date.parse(String(v));
  return Number.isNaN(t) ? 'bad' : new Date(t).toISOString();
};

export function checkPrice(raw: unknown): { ok: true; value: PriceInput } | { ok: false; errors: string[] } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const productLabel = str(r.productLabel, 120);
  if (productLabel.length < 3) errors.push('Enter the exact product, e.g. “iPhone 17 Pro 256GB”.');
  const platform = str(r.platform, 20).toUpperCase();
  if (!PLATFORM_IDS.includes(platform)) errors.push('Choose the platform.');
  const retailerName = str(r.retailerName, 60) || null;
  if (platform === 'OTHER' && !retailerName) errors.push('Enter the retailer’s name.');
  const selling = optInt(r.sellingPrice);
  if (selling === null || selling === 'bad' || selling < PRICE_MIN || selling > PRICE_MAX) errors.push('Enter the current selling price in rupees (a whole number).');
  const mrp = optInt(r.mrp);
  if (mrp === 'bad') errors.push('The MRP must be a whole number.');
  if (typeof selling === 'number' && typeof mrp === 'number' && mrp < selling) errors.push('The MRP can’t be lower than the selling price.');
  const availability = str(r.availability, 20).toUpperCase() || 'UNKNOWN';
  if (!AVAILABILITY.includes(availability as Availability)) errors.push('Availability must be In stock, Out of stock or Unknown.');
  const sourceUrl = str(r.sourceUrl, 600);
  if (!isHttpUrl(sourceUrl)) errors.push('Paste the retailer’s product page link (https://…). Every price needs a source.');
  const category = str(r.category, 30) || guessCategory(productLabel);

  const offers: OfferInput[] = [];
  const rawOffers = Array.isArray(r.offers) ? r.offers : [];
  if (rawOffers.length > 12) errors.push('At most 12 offers per price.');
  rawOffers.slice(0, 12).forEach((o, i) => {
    const x = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
    const n = `Offer ${i + 1}: `;
    const kind = str(x.kind, 20).toUpperCase();
    if (!OFFER_KINDS.includes(kind as OfferKind)) errors.push(`${n}choose the type.`);
    const title = str(x.title, 200);
    if (title.length < 3) errors.push(`${n}describe the offer.`);
    const amount = optInt(x.discountAmount);
    const pct = x.discountPercent === null || x.discountPercent === undefined || x.discountPercent === '' ? null : Number(x.discountPercent);
    if (amount === 'bad') errors.push(`${n}the discount amount must be a whole number.`);
    if (pct !== null && !(pct > 0 && pct <= 100)) errors.push(`${n}the discount percentage must be between 1 and 100.`);
    const minA = optInt(x.minAmount);
    const maxD = optInt(x.maxDiscount);
    if (minA === 'bad' || maxD === 'bad') errors.push(`${n}minimum and maximum amounts must be whole numbers.`);
    const vf = optDate(x.validFrom);
    const vu = optDate(x.validUntil);
    if (vf === 'bad' || vu === 'bad') errors.push(`${n}check the dates.`);
    else if (vf && vu && vf > vu) errors.push(`${n}the end date is before the start date.`);
    const link = str(x.link, 600);
    if (link && !isHttpUrl(link)) errors.push(`${n}the link must start with https://`);
    if (kind === 'BANK' && !str(x.bank, 80)) errors.push(`${n}name the bank or card.`);
    offers.push({
      kind: kind as OfferKind,
      title,
      bank: str(x.bank, 80) || null,
      discountAmount: typeof amount === 'number' ? amount : null,
      discountPercent: pct,
      minAmount: typeof minA === 'number' ? minA : null,
      maxDiscount: typeof maxD === 'number' ? maxD : null,
      validFrom: typeof vf === 'string' ? vf : null,
      validUntil: typeof vu === 'string' ? vu : null,
      variants: str(x.variants, 200) || null,
      terms: str(x.terms, 800) || null,
      link: link || null,
    });
  });
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { productLabel, category, platform: platform as PlatformId, retailerName: platform === 'OTHER' ? retailerName : null, mrp: typeof mrp === 'number' ? mrp : null, sellingPrice: selling as number, availability: availability as Availability, sourceUrl, offers },
  };
}

/* ───────────── offers ───────────── */

export interface OfferView {
  kind: string;
  validFrom: Date | string | null;
  validUntil: Date | string | null;
  discountAmount: number | null;
  discountPercent: number | null;
  minAmount: number | null;
  maxDiscount: number | null;
}
const ms = (d: Date | string | null) => (d === null ? null : typeof d === 'string' ? Date.parse(d) : d.getTime());

export type OfferState = 'ACTIVE' | 'EXPIRED' | 'UPCOMING';
/** An offer past its end date is EXPIRED and is never treated as active. One with no end date is ACTIVE (its validity just isn't stated). */
export function offerState(o: Pick<OfferView, 'validFrom' | 'validUntil'>, now: Date): OfferState {
  const from = ms(o.validFrom);
  const until = ms(o.validUntil);
  if (until !== null && until < now.getTime()) return 'EXPIRED';
  if (from !== null && from > now.getTime()) return 'UPCOMING';
  return 'ACTIVE';
}

/** Rupees an offer takes off a given price: 0 if it is not active, the price is below its minimum, or it has no amount (e.g. no-cost EMI). */
export function offerSaving(o: OfferView, price: number, now: Date): number {
  if (offerState(o, now) !== 'ACTIVE') return 0;
  if (o.kind === 'NO_COST_EMI') return 0;
  if (o.minAmount !== null && price < o.minAmount) return 0;
  let s = o.discountAmount ?? (o.discountPercent !== null ? (price * o.discountPercent) / 100 : 0);
  if (o.maxDiscount !== null) s = Math.min(s, o.maxDiscount);
  return Math.max(0, Math.min(Math.round(s), price));
}

/* ───────────── comparison ───────────── */

export interface RowView {
  id: string;
  platform: string;
  sellingPrice: number;
  mrp: number | null;
  availability: string;
  fetchedAt: Date | string;
  offers: (OfferView & { id: string })[];
}
export type PriceStatus = 'VERIFIED' | 'OLD' | 'UNAVAILABLE';
export const hoursOld = (at: Date | string, now: Date) => Math.max(0, (now.getTime() - (ms(at) as number)) / 3_600_000);

export function priceStatus(row: Pick<RowView, 'fetchedAt'> | null, now: Date): PriceStatus {
  if (!row) return 'UNAVAILABLE';
  return hoursOld(row.fetchedAt, now) > STALE_HOURS ? 'OLD' : 'VERIFIED';
}

export function discountPercent(mrp: number | null, selling: number): number | null {
  return mrp && mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : null;
}

/** Best price after the active offers that need a card/exchange, kept apart from the plain selling price. */
export function bestConditional(row: RowView, now: Date): { price: number; saving: number; offerId: string } | null {
  let best: { saving: number; offerId: string } | null = null;
  for (const o of row.offers) {
    const s = offerSaving(o, row.sellingPrice, now);
    if (s > 0 && (!best || s > best.saving)) best = { saving: s, offerId: o.id };
  }
  return best ? { price: row.sellingPrice - best.saving, ...best } : null;
}

export interface GroupSummary {
  /** Lowest unconditional selling price among fresh, not-out-of-stock rows. */
  lowestPrice: number | null;
  lowestRowIds: string[];
  highestPrice: number | null;
  spread: number | null;
  verifiedCount: number;
  oldCount: number;
  unavailableCount: number;
  /** Lowest price after the best card/exchange offer, only when it beats the plain lowest. */
  lowestWithOffer: { price: number; rowId: string } | null;
}

export function summariseGroup(rows: RowView[], now: Date): GroupSummary {
  const fresh = rows.filter((r) => priceStatus(r, now) === 'VERIFIED' && r.availability !== 'OUT_OF_STOCK');
  const prices = fresh.map((r) => r.sellingPrice);
  const lowest = prices.length ? Math.min(...prices) : null;
  const highest = prices.length ? Math.max(...prices) : null;
  let withOffer: GroupSummary['lowestWithOffer'] = null;
  for (const r of fresh) {
    const c = bestConditional(r, now);
    if (c && (!withOffer || c.price < withOffer.price)) withOffer = { price: c.price, rowId: r.id };
  }
  if (withOffer && lowest !== null && withOffer.price >= lowest) withOffer = null;
  const platformsWithRow = new Set(rows.map((r) => r.platform));
  return {
    lowestPrice: lowest,
    lowestRowIds: lowest === null ? [] : fresh.filter((r) => r.sellingPrice === lowest).map((r) => r.id),
    highestPrice: highest,
    spread: lowest !== null && highest !== null ? highest - lowest : null,
    verifiedCount: rows.filter((r) => priceStatus(r, now) === 'VERIFIED').length,
    oldCount: rows.filter((r) => priceStatus(r, now) === 'OLD').length,
    unavailableCount: PLATFORMS.filter((p) => p.id !== 'OTHER' && !platformsWithRow.has(p.id)).length,
    lowestWithOffer: withOffer,
  };
}

/* ───────────── sharing ───────────── */

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export interface ShareRow {
  platformLabel: string;
  status: PriceStatus;
  sellingPrice: number | null;
  availability: string;
  offerLines: string[];
  updatedLabel: string;
  url: string | null;
  isLowest: boolean;
}

/** Plain text a rep can paste to a customer. Only verified prices are listed with a number; others say so. */
export function shareText(label: string, rows: ShareRow[]): string {
  const lines = [`${label}: online prices`, ''];
  for (const r of rows) {
    if (r.status === 'UNAVAILABLE' || r.sellingPrice === null) {
      lines.push(`• ${r.platformLabel}: price could not be verified`);
      continue;
    }
    const flags = [r.isLowest ? 'lowest' : '', r.status === 'OLD' ? 'price may be out of date' : '', r.availability === 'OUT_OF_STOCK' ? 'out of stock' : ''].filter(Boolean);
    lines.push(`• ${r.platformLabel}: ${inr(r.sellingPrice)}${flags.length ? ` (${flags.join(', ')})` : ''} — updated ${r.updatedLabel}`);
    r.offerLines.forEach((o) => lines.push(`    - ${o}`));
    if (r.url) lines.push(`    ${r.url}`);
  }
  lines.push('', 'Prices change often; please confirm on the retailer’s page before buying.');
  return lines.join('\n');
}
