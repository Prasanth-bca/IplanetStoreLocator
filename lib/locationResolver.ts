/**
 * Location Resolver for iPlanet Store Locator
 *
 * Turns a search (PIN code, area, landmark, city) into coordinates, fast and with sanity checks:
 * 1. 6-digit PIN codes: OpenStreetMap postcode search and Photon in parallel; then a store with
 *    the same PIN; then the India Post office name for that PIN.
 * 2. Text: an exact store city name resolves locally (no network).
 * 3. Text: Google (if a key is set), then Ola Maps (if its key works), then OpenStreetMap
 *    Nominatim and Photon in parallel, then an exact store area/locality name.
 * 4. A result is rejected if it falls outside India, or more than CITY_GUARD_KM from a city the
 *    query names. If nothing passes but a known city was named, that city's centre is used and
 *    the location is marked approximate.
 *
 * Every network call has a hard timeout, so a slow provider can't stall a search.
 * Results are cached in memory for 24 hours and concurrent identical lookups share one request.
 */

import type { Store } from '@/types/store';
import { calculateHaversineDistance } from '@/lib/routing';

export interface GeocodedLocation {
  lat: number;
  lng: number;
  city?: string;
  area?: string;
  name: string;
  /** True when only the city could be identified, not the exact place. */
  approximate?: boolean;
}

interface CacheEntry {
  data: GeocodedLocation;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const GEOCODE_TIMEOUT_MS = 2500;
/** A geocoder answer further than this from a city the user named is treated as wrong. */
const CITY_GUARD_KM = 60;
const USER_AGENT = 'iPlanetAIStoreLocator/2.0 (iPlanet Retail Store Discovery Engine)';

const geocodeCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<GeocodedLocation | null>>();

// Common alternate spellings mapped to the city names used in the store master.
const CITY_ALIASES: Record<string, string> = {
  bangalore: 'bengaluru',
  madras: 'chennai',
  cochin: 'kochi',
  ernakulam: 'kochi',
  trivandrum: 'thiruvananthapuram',
  vizag: 'visakhapatnam',
  trichy: 'tiruchirappalli',
  pondicherry: 'puducherry',
  bombay: 'mumbai',
};

interface Anchor {
  name: string;
  lat: number;
  lng: number;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function inIndia(lat: number, lng: number): boolean {
  return lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;
}

function hasCoords(s: Store): s is Store & { latitude: number; longitude: number } {
  return typeof s.latitude === 'number' && typeof s.longitude === 'number' && !isNaN(s.latitude) && !isNaN(s.longitude);
}

/** Centroid of store coordinates grouped by a key (city, area, PIN). */
function buildAnchors(stores: Store[], keyOf: (s: Store) => (string | null | undefined)[]): Map<string, Anchor> {
  const acc = new Map<string, { name: string; lat: number; lng: number; n: number }>();
  for (const s of stores) {
    if (!hasCoords(s)) continue;
    for (const raw of keyOf(s)) {
      if (!raw) continue;
      const k = norm(raw);
      if (!k) continue;
      const a = acc.get(k) ?? { name: raw.trim(), lat: 0, lng: 0, n: 0 };
      a.lat += s.latitude;
      a.lng += s.longitude;
      a.n++;
      acc.set(k, a);
    }
  }
  const out = new Map<string, Anchor>();
  acc.forEach((a, k) => out.set(k, { name: a.name, lat: a.lat / a.n, lng: a.lng / a.n }));
  return out;
}

/** The first store city named in the query, e.g. "ashoka pillar chennai" -> Chennai. */
function mentionedCity(query: string, cities: Map<string, Anchor>): Anchor | undefined {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    for (const span of [words.slice(i, i + 2).join(''), words[i]]) {
      const key = CITY_ALIASES[span] ?? span;
      const hit = cities.get(key);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Grace period for the preferred provider once the other one has already answered. */
const PREFERRED_GRACE_MS = 600;

/**
 * Runs two lookups in parallel and resolves with the preferred one's answer when it arrives in time,
 * otherwise the fallback's. Waits at most PREFERRED_GRACE_MS for `preferred` after `fallback` answers.
 */
function preferFirst<T>(preferred: Promise<T | null>, fallback: Promise<T | null>, accept: (v: T | null) => boolean): Promise<T | null> {
  return new Promise(resolve => {
    let done = false;
    let preferredSettled = false;
    let fallbackValue: T | null = null;
    let fallbackSettled = false;
    const finish = (v: T | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };

    preferred.then(v => {
      preferredSettled = true;
      if (accept(v)) finish(v);
      else if (fallbackSettled) finish(accept(fallbackValue) ? fallbackValue : null);
    });
    fallback.then(v => {
      fallbackSettled = true;
      fallbackValue = v;
      if (preferredSettled) finish(accept(v) ? v : null);
      else if (accept(v)) setTimeout(() => finish(v), PREFERRED_GRACE_MS);
    });
  });
}

/**
 * Resolves any Indian location query (PIN code, locality, landmark, city, mall) into coordinates.
 * `stores` (the store master) powers instant local matches and the city sanity check.
 */
export async function resolveLocation(
  query: string,
  pincode?: string,
  stores: Store[] = []
): Promise<GeocodedLocation | null> {
  const key = (pincode || query).trim().toLowerCase();

  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const work = (async () => {
    const resolved =
      pincode && /^\d{6}$/.test(pincode) ? await resolvePincode(pincode, stores) : await resolveText(query, stores);

    if (resolved) {
      if (geocodeCache.size >= CACHE_MAX_ENTRIES) {
        const oldest = geocodeCache.keys().next().value;
        if (oldest !== undefined) geocodeCache.delete(oldest);
      }
      geocodeCache.set(key, { data: resolved, timestamp: Date.now() });
    }
    return resolved;
  })().finally(() => inflight.delete(key));

  inflight.set(key, work);
  return work;
}

async function resolvePincode(pincode: string, stores: Store[]): Promise<GeocodedLocation | null> {
  // OpenStreetMap's postcode search is the most precise when it answers; Photon covers it when it doesn't.
  const hit = await preferFirst<GeocodedLocation & { postcode?: string }>(
    nominatimPostcode(pincode),
    photonSearch(pincode),
    v => !!v && inIndia(v.lat, v.lng) && (!v.postcode || v.postcode === pincode)
  );
  if (hit) return { lat: hit.lat, lng: hit.lng, city: hit.city, area: hit.area, name: labelForPin(hit, pincode) };

  // A store registered at this PIN is inside the PIN area by definition.
  const pinAnchor = buildAnchors(stores, s => [s.pincode]).get(pincode);
  if (pinAnchor) return { lat: pinAnchor.lat, lng: pinAnchor.lng, name: `PIN ${pincode}` };

  return resolveViaPostOffice(pincode);
}

function labelForPin(loc: GeocodedLocation, pincode: string): string {
  const place = [loc.area, loc.city].filter((v, i, arr) => v && arr.indexOf(v) === i).join(', ');
  return place ? `${place} (PIN ${pincode})` : `PIN ${pincode}`;
}

/** Last resort for PINs: geocode the India Post office name, cleaned of notes like "(Reopened W.E.F...)". */
async function resolveViaPostOffice(pincode: string): Promise<GeocodedLocation | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const po = data?.[0]?.Status === 'Success' ? data[0].PostOffice?.[0] : null;
    if (!po) return null;

    const place = String(po.Name || '')
      .replace(/\(.*?\)/g, '')
      .replace(/\b[BSH]\.?O\b\.?/gi, '')
      .trim();
    const district = po.District || '';
    const state = po.State || '';

    const [osm, photon] = await Promise.all([
      nominatimSearch(`${place}, ${district}, ${state}`),
      photonSearch(`${place} ${district} ${state}`),
    ]);
    const hit = osm ?? photon;
    if (!hit) return null;
    return { ...hit, city: district || hit.city, area: place || hit.area, name: `${place}, ${district} (PIN ${pincode})` };
  } catch (err) {
    console.warn(`[LocationResolver] Postal PIN lookup failed for ${pincode}:`, err);
    return null;
  }
}

async function resolveText(query: string, stores: Store[]): Promise<GeocodedLocation | null> {
  const cities = buildAnchors(stores, s => [s.city]);
  const k = norm(query);

  // Instant local answer for an exact city name: the centre of that city's stores.
  const exactCity = cities.get(CITY_ALIASES[k] ?? k);
  if (exactCity) return { lat: exactCity.lat, lng: exactCity.lng, city: exactCity.name, name: exactCity.name };

  const city = mentionedCity(query, cities);
  const plausible = (r: GeocodedLocation | null): r is GeocodedLocation =>
    !!r &&
    inIndia(r.lat, r.lng) &&
    (!city || calculateHaversineDistance(r.lat, r.lng, city.lat, city.lng) <= CITY_GUARD_KM);

  // Keyed providers first: they're the most accurate when configured and working.
  const google = await googleGeocode(query);
  if (plausible(google)) return google;

  const { getOlaGeocoding } = await import('./olaMaps');
  const ola = await getOlaGeocoding(query, GEOCODE_TIMEOUT_MS);
  if (plausible(ola)) return ola;

  // Free providers in parallel, so the slower one never adds to the wait.
  const free = await preferFirst(nominatimSearch(query), photonSearch(query, city), plausible);
  if (free) return free;

  // Store area/locality names come next. Only as a fallback: store coordinates aren't always exact.
  const exactArea = buildAnchors(stores, s => [s.area, s.locality]).get(k);
  if (exactArea) return { lat: exactArea.lat, lng: exactArea.lng, area: exactArea.name, name: exactArea.name };

  if (city) {
    return { lat: city.lat, lng: city.lng, city: city.name, name: `${city.name} (approximate)`, approximate: true };
  }
  return null;
}

async function googleGeocode(query: string): Promise<GeocodedLocation | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:IN&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS) });
    if (!res.ok) return null;

    const data = await res.json();
    const first = data.status === 'OK' ? data.results?.[0] : null;
    if (!first) return null;

    let city: string | undefined;
    let area: string | undefined;
    for (const comp of first.address_components || []) {
      if (comp.types.includes('locality')) city = comp.long_name;
      if (comp.types.includes('sublocality') || comp.types.includes('sublocality_level_1')) area = comp.long_name;
    }
    return { lat: first.geometry.location.lat, lng: first.geometry.location.lng, city, area, name: first.formatted_address };
  } catch (err) {
    console.warn(`[LocationResolver] Google Geocoding failed for "${query}":`, err);
    return null;
  }
}

function parseNominatim(list: any): GeocodedLocation | null {
  const item = Array.isArray(list) ? list[0] : null;
  if (!item) return null;
  const lat = parseFloat(item.lat);
  const lng = parseFloat(item.lon);
  if (isNaN(lat) || isNaN(lng)) return null;

  const addr = item.address || {};
  const city = addr.city || addr.town || addr.state_district || addr.district;
  const area = addr.suburb || addr.neighbourhood || addr.village || addr.city_district;
  const parts = String(item.display_name || '').split(',').map((s: string) => s.trim());
  return { lat, lng, city, area, name: parts.slice(0, 3).join(', ') || item.display_name };
}

async function nominatim(params: Record<string, string>): Promise<GeocodedLocation | null> {
  try {
    const qs = new URLSearchParams({ ...params, countrycodes: 'in', format: 'json', addressdetails: '1', limit: '1' });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return parseNominatim(await res.json());
  } catch {
    return null; // timeouts are expected occasionally; the parallel provider covers them
  }
}

const nominatimSearch = (query: string) => nominatim({ q: query });
const nominatimPostcode = (pincode: string) => nominatim({ postalcode: pincode });

/** Photon (OpenStreetMap data, komoot). Optionally biased towards a city the query named. */
async function photonSearch(query: string, near?: Anchor): Promise<(GeocodedLocation & { postcode?: string }) | null> {
  try {
    const qs = new URLSearchParams({ q: /^\d{6}$/.test(query) ? `${query} India` : query, limit: '1', bbox: '68,6,97.5,37.5' });
    if (near) {
      qs.set('lat', String(near.lat));
      qs.set('lon', String(near.lng));
    }
    const res = await fetch(`https://photon.komoot.io/api/?${qs}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const f = data?.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (!Array.isArray(coords)) return null;

    const p = f.properties || {};
    const city = p.city || p.county || p.state;
    const area = p.district || p.locality || p.name;
    return {
      lat: coords[1],
      lng: coords[0],
      city,
      area,
      postcode: p.postcode,
      name: [p.name, city].filter((v, i, arr) => v && arr.indexOf(v) === i).join(', ') || query,
    };
  } catch {
    return null;
  }
}
