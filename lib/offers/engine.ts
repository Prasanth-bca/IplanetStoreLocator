import { offerState } from './dates';
import { bankOfferMatches, storeOfferMatches } from './match';
import type { BankOfferData, CampaignData, CatalogueProduct, StoreOfferData } from './types';

export interface OffersForProduct {
  store: StoreOfferData[];
  bank: BankOfferData[];
  upcoming: { store: string | null; bank: string | null };
}

const earliest = (dates: string[]) => (dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null);

/**
 * The offers that apply to one product today: matching, Active, and inside their dates. Expired and
 * inactive offers are never returned. Offers that match but haven't started are not returned either;
 * only the earliest start date is, so the panel can say "starts on …" instead of "none".
 */
export function offersForProduct(
  product: CatalogueProduct,
  storeOffers: StoreOfferData[],
  bankOffers: BankOfferData[],
  today: string
): OffersForProduct {
  const pick = <T extends { status: string; validFrom: string | null; validUntil: string | null }>(rows: T[], matches: (r: T) => boolean) => {
    const live: T[] = [];
    const notYet: string[] = [];
    for (const r of rows) {
      if (r.status !== 'Active' || !matches(r)) continue;
      const state = offerState(r.validFrom, r.validUntil, today);
      if (state === 'active') live.push(r);
      else if (state === 'upcoming' && r.validFrom) notYet.push(r.validFrom);
    }
    return { live, upcoming: earliest(notYet) };
  };

  const s = pick(storeOffers, (o) => storeOfferMatches(o, product));
  const b = pick(bankOffers, (o) => bankOfferMatches(o, product));
  return { store: s.live, bank: b.live, upcoming: { store: s.upcoming, bank: b.upcoming } };
}

/** The campaign whose window includes today, if any. Both ends inclusive. */
export function runningCampaign(campaigns: CampaignData[], today: string): CampaignData | null {
  return campaigns.find((c) => c.active && c.startDate <= today && today <= c.endDate) ?? null;
}
