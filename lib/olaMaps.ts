/**
 * Ola Maps Integration for iPlanet Store Locator
 *
 * Ola Maps provides:
 * - Free tier: 100,000 API calls/month at ₹0
 * - India-focused mapping and routing
 * - Distance Matrix API for multiple origin-destination pairs
 *
 * Ola's REST API takes the key as an `api_key` query parameter on GET requests.
 * Documentation: https://maps.olakrutrim.com
 */

export interface OlaDistanceMatrixResult {
  distance_km: number;
  duration_minutes: number;
  isRealData: boolean;
}

export interface OlaGeocodingResult {
  lat: number;
  lng: number;
  name: string;
  city?: string;
  area?: string;
}

const OLA_BASE = 'https://api.olamaps.io';

// When Ola rejects the key (401/403), stop calling it for a while instead of
// paying a failed round-trip on every search.
const KEY_FAILURE_BACKOFF_MS = 10 * 60 * 1000;
let olaDisabledUntil = 0;

function olaKey(): string | null {
  const key = process.env.OLA_MAPS_API_KEY?.trim();
  if (!key || Date.now() < olaDisabledUntil) return null;
  return key;
}

function noteFailure(status: number, what: string) {
  if (status === 401 || status === 403) {
    if (Date.now() >= olaDisabledUntil) {
      console.warn(`Ola Maps rejected the API key (${status}) on ${what}; skipping Ola for 10 minutes. Check OLA_MAPS_API_KEY.`);
    }
    olaDisabledUntil = Date.now() + KEY_FAILURE_BACKOFF_MS;
  } else {
    console.warn(`Ola Maps ${what} error: ${status}`);
  }
}

/**
 * One Distance Matrix call for one origin and many destinations.
 * Returns results in destination order (null where Ola had no route), or null if the call failed.
 */
export async function getOlaDistances(
  originLat: number,
  originLng: number,
  destinations: { lat: number; lng: number }[],
  timeoutMs = 3000
): Promise<(OlaDistanceMatrixResult | null)[] | null> {
  const apiKey = olaKey();
  if (!apiKey || destinations.length === 0) return null;

  try {
    const params = new URLSearchParams({
      origins: `${originLat},${originLng}`,
      destinations: destinations.map(d => `${d.lat},${d.lng}`).join('|'),
      api_key: apiKey,
    });
    const response = await fetch(`${OLA_BASE}/routing/v1/distanceMatrix/basic?${params}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      noteFailure(response.status, 'Distance Matrix');
      return null;
    }

    const data = await response.json();
    const elements: any[] = (data.rows ?? data.data?.rows)?.[0]?.elements ?? [];
    if (elements.length === 0) return null;

    return destinations.map((_, i) => {
      const el = elements[i];
      if (!el || String(el.status).toLowerCase() !== 'ok' || el.distance == null || el.duration == null) return null;
      return {
        distance_km: Math.round((el.distance / 1000) * 10) / 10,
        duration_minutes: Math.max(1, Math.round(el.duration / 60)),
        isRealData: true,
      };
    });
  } catch (error) {
    console.warn('Ola Maps Distance Matrix call failed:', error);
    return null;
  }
}

/**
 * Forward geocoding of a free-text Indian address, area, landmark or PIN.
 */
export async function getOlaGeocoding(query: string, timeoutMs = 2500): Promise<OlaGeocodingResult | null> {
  const apiKey = olaKey();
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({ address: query, language: 'English', api_key: apiKey });
    const response = await fetch(`${OLA_BASE}/places/v1/geocode?${params}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      noteFailure(response.status, 'Geocoding');
      return null;
    }

    const data = await response.json();
    const first = (data.geocodingResults ?? data.results)?.[0];
    const location = first?.geometry?.location;
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') return null;

    const parts: string[] = (first.formatted_address || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    return {
      lat: location.lat,
      lng: location.lng,
      name: parts.slice(0, 3).join(', ') || first.name || query,
      area: parts[0],
      city: parts[1],
    };
  } catch (error) {
    console.warn('Ola Maps Geocoding failed:', error);
    return null;
  }
}
