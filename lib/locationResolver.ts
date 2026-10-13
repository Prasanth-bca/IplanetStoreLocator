/**
 * Location Resolver for iPlanet Store Locator
 * 
 * Fully dynamic geocoder with prioritized resolution strategies:
 * 1. Exact 6-digit Indian PIN code resolution via India Postal API (postalpincode.in)
 * 2. Official Google Maps Geocoding API (when GOOGLE_MAPS_API_KEY is configured in .env)
 * 3. OpenStreetMap / Nominatim live geocoding service for Indian landmarks, localities, and cities
 * 
 * Results are cached in an in-memory TTL cache to optimize repeated queries and avoid redundant network calls.
 * No hardcoded search-to-store results or static response mappings.
 */

export interface GeocodedLocation {
  lat: number;
  lng: number;
  city?: string;
  area?: string;
  name: string;
}

interface CacheEntry {
  data: GeocodedLocation;
  timestamp: number;
}

// 24-hour TTL in-memory cache for dynamic geocoding results
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const geocodeCache = new Map<string, CacheEntry>();

/**
 * Resolves any Indian location query (PIN code, locality, landmark, city, mall)
 * into geographic coordinates (latitude & longitude) dynamically.
 */
export async function resolveLocation(
  query: string,
  pincode?: string
): Promise<GeocodedLocation | null> {
  const normalizedKey = (pincode || query).trim().toLowerCase();

  // Check in-memory TTL cache first
  const cached = geocodeCache.get(normalizedKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  let resolved: GeocodedLocation | null = null;

  // Strategy 1: Dynamic PIN Code resolution via India Postal API
  if (pincode && /^\d{6}$/.test(pincode)) {
    resolved = await resolveViaPostalPincode(pincode);
  }

  // Strategy 2: Ola Maps Geocoding (FREE tier, India-optimized)
  if (!resolved) {
    resolved = await resolveViaOlaMaps(query);
  }

  // Strategy 3: Google Maps Geocoding API if configured
  if (!resolved) {
    resolved = await resolveViaGoogleMaps(query);
  }

  // Strategy 4: OpenStreetMap Nominatim Live Geocoding
  if (!resolved) {
    resolved = await resolveViaNominatim(pincode || query);
  }

  // Save in cache if successfully resolved
  if (resolved) {
    geocodeCache.set(normalizedKey, {
      data: resolved,
      timestamp: Date.now()
    });
  }

  return resolved;
}

/**
 * Resolves a 6-digit Indian PIN Code dynamically using postalpincode.in
 * and fetches coordinates for the identified post office / district.
 */
async function resolveViaPostalPincode(pincode: string): Promise<GeocodedLocation | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      const placeName = po.Name;
      const district = po.District || po.Division || '';
      const state = po.State || '';

      // Geocode the identified post office place name
      const searchQuery = `${placeName}, ${district}, ${state}, India`;
      const coords = await resolveViaNominatim(searchQuery);

      if (coords) {
        return {
          lat: coords.lat,
          lng: coords.lng,
          city: district || coords.city,
          area: placeName || coords.area,
          name: `${placeName}, ${district} (PIN ${pincode})`
        };
      }

      // If specific PO search fails, try district level
      if (district) {
        const districtCoords = await resolveViaNominatim(`${district}, ${state}, India`);
        if (districtCoords) {
          return {
            lat: districtCoords.lat,
            lng: districtCoords.lng,
            city: district,
            area: placeName,
            name: `${placeName}, ${district} (PIN ${pincode})`
          };
        }
      }
    }
  } catch (err) {
    console.warn(`[LocationResolver] Postal PIN API lookup failed for ${pincode}:`, err);
  }

  return null;
}

/**
 * Resolves location using Ola Maps Geocoding API (FREE tier, India-optimized)
 */
async function resolveViaOlaMaps(query: string): Promise<GeocodedLocation | null> {
  try {
    const { getOlaGeocoding } = await import('./olaMaps');
    const result = await getOlaGeocoding(query);

    if (result) {
      return {
        lat: result.lat,
        lng: result.lng,
        city: result.city,
        area: result.area,
        name: result.name
      };
    }
  } catch (err) {
    console.warn(`[LocationResolver] Ola Maps lookup failed for "${query}":`, err);
  }

  return null;
}

/**
 * Resolves location using Google Maps Geocoding API (if key is set)
 */
async function resolveViaGoogleMaps(query: string): Promise<GeocodedLocation | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + ', India')}&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const first = data.results[0];
      const lat = first.geometry.location.lat;
      const lng = first.geometry.location.lng;

      let city: string | undefined;
      let area: string | undefined;

      for (const comp of first.address_components || []) {
        if (comp.types.includes('locality')) city = comp.long_name;
        if (comp.types.includes('sublocality') || comp.types.includes('sublocality_level_1')) area = comp.long_name;
      }

      return {
        lat,
        lng,
        city,
        area,
        name: first.formatted_address
      };
    }
  } catch (err) {
    console.warn(`[LocationResolver] Google Geocoding failed for "${query}":`, err);
  }

  return null;
}

/**
 * Resolves location using OpenStreetMap Nominatim Live Geocoding
 */
async function resolveViaNominatim(query: string): Promise<GeocodedLocation | null> {
  try {
    const cleanQuery = query.trim();
    const fullQuery = cleanQuery.toLowerCase().includes('india') ? cleanQuery : `${cleanQuery}, India`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullQuery)}&format=json&addressdetails=1&limit=1`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'iPlanetAIStoreLocator/2.0 (iPlanet Retail Store Discovery Engine)'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return null;
    const list = await res.json();

    if (Array.isArray(list) && list.length > 0) {
      const item = list[0];
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);

      if (!isNaN(lat) && !isNaN(lng)) {
        const addr = item.address || {};
        const city = addr.city || addr.town || addr.district || addr.state_district;
        const area = addr.suburb || addr.neighbourhood || addr.village || item.name;

        // Produce a clean, readable name
        const displayParts = item.display_name.split(',').map((s: string) => s.trim());
        const shortName = displayParts.slice(0, 3).join(', ');

        return {
          lat,
          lng,
          city,
          area,
          name: shortName || item.display_name
        };
      }
    }
  } catch (err) {
    console.warn(`[LocationResolver] Nominatim lookup failed for "${query}":`, err);
  }

  return null;
}
