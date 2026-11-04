/**
 * Live price feeds. A provider is any authorised source (a licensed price API, the Amazon / Flipkart affiliate APIs, ...).
 * None is connected yet, so a refresh reports that honestly and every platform without a saved price stays
 * "could not be verified". To connect one, add an object here that returns real listings with their source links; the
 * refresh route saves whatever it returns as sourceKind "API". Never return a guessed price.
 */
import type { PriceInput } from './rules';

export interface ProviderListing extends PriceInput {
  sourceName: string;
}
export interface MarketProvider {
  id: string;
  name: string;
  configured: () => boolean;
  fetchListings: (query: string) => Promise<ProviderListing[]>;
}

export const PROVIDERS: MarketProvider[] = [];
export const configuredProviders = () => PROVIDERS.filter((p) => p.configured());
