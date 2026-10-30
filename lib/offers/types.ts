/** Shared shapes for the offers feature. Dates are India calendar dates as "YYYY-MM-DD" strings. */

export const OFFER_CATEGORIES = ['iPhone', 'iPad', 'Mac', 'Watch', 'AirPods', 'HomePod', 'Beats', 'Accessories', 'Other'] as const;
export const STORE_DISCOUNT_TYPES = ['Percent', 'Amount (₹)', 'Benefit (text)'] as const;
export const BANK_OFFER_TYPES = [
  'Card EMI Cashback (6M No Cost EMI)',
  'Card Full Swipe Cashback',
  'Loan Scheme',
  'Trade-in Top-up (TiTu)',
  'iPhone for Life EMI',
  'Easy Instalments Program',
] as const;
export const EMI_TYPES = ['EMI', 'Non-EMI', 'Loan', 'Not applicable'] as const;
export const MATCH_TYPES = ['Exact', 'Contains all'] as const;
export const THEMES = ['Diwali', 'None'] as const;

export interface StoreOfferData {
  offerId: string;
  category: string;
  productName: string;
  variant: string | null;
  storage: string | null;
  offerType: string;
  tradeIn: string | null;
  customer: string;
  discountType: string;
  discountValue: number | null;
  isUpTo: boolean | null;
  offerText: string;
  eligibility: string | null;
  combinable: boolean;
  /** Null = no start date (already running). */
  validFrom: string | null;
  validUntil: string | null;
  terms: string | null;
  status: string;
  source: string | null;
}

export interface BankOfferData {
  offerId: string;
  bank: string;
  category: string;
  productName: string;
  variant: string | null;
  matchType: string;
  matchText: string;
  cardType: string | null;
  offerType: string;
  amount: number | null;
  percent: number | null;
  minTxn: number | null;
  maxCashback: number | null;
  emiType: string;
  details: string | null;
  rvFrom: number | null;
  rvTo: number | null;
  combinable: boolean;
  /** Null = no start date (already running). */
  validFrom: string | null;
  validUntil: string | null;
  terms: string | null;
  status: string;
  source: string | null;
}

export interface CampaignData {
  name: string;
  label: string;
  theme: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

/** The product a person picked, as the catalogue knows it. */
export interface CatalogueProduct {
  sku: string;
  name: string;
  class: string | null;
  category: string;
  variant: string | null;
}

/** What GET /api/offers returns for one selected device. */
export interface OffersResponse {
  product: { sku: string; name: string; variant: string | null; category: string } | null;
  /** The running campaign, or null once it has ended (or before it starts). */
  campaign: { name: string; label: string; theme: string; startDate: string; endDate: string } | null;
  store: StoreOfferData[];
  bank: BankOfferData[];
  /** Earliest start date of a matching offer that has not started yet, for the empty-state message. */
  upcoming: { store: string | null; bank: string | null };
  /** ISO timestamp of the last successful import; null if offers were never imported. */
  lastUpdated: string | null;
  /** False when no offers have ever been imported (different from "no offer for this product"). */
  hasData: boolean;
  today: string;
}
