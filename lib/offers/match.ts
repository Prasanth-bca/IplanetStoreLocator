/**
 * Decides which offers apply to a catalogue product. Matching ignores capitals, spaces and symbols,
 * so "AirPods5", "Airpods 5" and "airpods-5" are the same product family.
 */

import type { BankOfferData, CatalogueProduct, StoreOfferData } from './types';

export const norm = (s: string | null | undefined): string => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The catalogue Class names a model family; a few products have none, so fall back to the name. */
function familyKey(p: CatalogueProduct): string {
  return norm(p.class) || norm(p.name);
}

/** Store offers name the family exactly (e.g. "iPhone 17 Pro"); variant and storage narrow it if given. */
export function storeOfferMatches(o: Pick<StoreOfferData, 'productName' | 'variant' | 'storage'>, p: CatalogueProduct): boolean {
  if (familyKey(p) !== norm(o.productName)) return false;
  const text = norm(`${p.name} ${p.variant ?? ''} ${p.class ?? ''}`);
  if (o.variant && !text.includes(norm(o.variant))) return false;
  if (o.storage && !text.includes(norm(o.storage))) return false;
  return true;
}

/**
 * Bank offers name a family that may be broader than the catalogue (the deck says "MacBook Pro").
 * "Exact": the family key must equal the text. "Contains all": every word must appear in the Class or the Name.
 */
export function bankOfferMatches(o: Pick<BankOfferData, 'matchType' | 'matchText'>, p: CatalogueProduct): boolean {
  const tokens = o.matchText.split(';').map(norm).filter(Boolean);
  if (tokens.length === 0) return false;
  if (o.matchType === 'Exact') return familyKey(p) === tokens[0];
  const cls = norm(p.class);
  const nm = norm(p.name);
  return tokens.every((t) => cls.includes(t) || nm.includes(t));
}
