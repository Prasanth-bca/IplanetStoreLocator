import { Store, StoreSearchResult, SearchResponse, StoreCategory } from '@/types/store';
import { getAllStores } from '@/lib/storeRepo';
import { parseNaturalQuery } from '@/lib/searchParser';
import { resolveLocation } from '@/lib/locationResolver';
import { calculateRoute, calculateHaversineDistance } from '@/lib/routing';

export interface SearchOptions {
  query: string;
  latitude?: number;
  longitude?: number;
  pincode?: string;
  limit?: number;
  storeCategory?: StoreCategory;
  radiusKm?: number;
}

/** Standard straight-line geographic radius threshold in Kilometers */
export const DEFAULT_SEARCH_RADIUS_KM = 100;

export async function searchStores(options: SearchOptions): Promise<SearchResponse> {
  const {
    query,
    latitude,
    longitude,
    pincode: directPincode,
    limit: directLimit,
    storeCategory: directCategory,
    radiusKm = DEFAULT_SEARCH_RADIUS_KM
  } = options;

  const parsed = parseNaturalQuery(query || '');

  // 1. Determine Store Category from user action or intent:
  // Default to Retail Stores only, unless Care/Service was specifically requested
  const category: StoreCategory = directCategory || (parsed.isCareIntent ? 'Care' : 'Retail');

  // 2. Fetch live store records directly from the database (never from hardcoded lists)
  // Only consider 'Active' stores
  const allDatabaseStores = getAllStores(category).filter(s => s.status === 'Active');

  const requestedLimit = directLimit || parsed.requestedCount || 3;
  const effectivePincode = directPincode || parsed.pincodeMatch;

  // 3. Priority match: Direct POS Code match (e.g. user searches "RMM", "CBE3", "VLR1")
  if (parsed.posCodeMatch) {
    const cleanSearchPos = parsed.posCodeMatch.replace(/\s+/g, '').toUpperCase();
    const exactMatch = allDatabaseStores.find(s => {
      const sPos = s.posCode.replace(/\s+/g, '').toUpperCase();
      return sPos === cleanSearchPos || sPos.replace(/1$/, '') === cleanSearchPos || cleanSearchPos.replace(/1$/, '') === sPos;
    });

    if (exactMatch) {
      const directionsUrl = exactMatch.latitude && exactMatch.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${exactMatch.latitude},${exactMatch.longitude}`
        : exactMatch.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exactMatch.storeName)}`;

      return {
        query,
        detectedLocation: { name: `POS Code: ${exactMatch.posCode}` },
        category,
        requestedCount: 1,
        totalFound: 1,
        results: [
          {
            store: exactMatch,
            rank: 1,
            isPreferred: true,
            matchReason: `Exact POS Code match (${exactMatch.posCode})`,
            distanceKm: null,
            travelTimeMinutes: null,
            trafficLevel: null,
            howToReach: `Located at ${exactMatch.address}.${exactMatch.landmark ? ' Landmark: ' + exactMatch.landmark + '.' : ''}`,
            directionsUrl
          }
        ],
        isGoogleRoutingAvailable: false
      };
    }
  }

  // 4. Dynamically resolve the searched location into Latitude and Longitude
  let userLat = latitude;
  let userLng = longitude;
  let resolvedLocName: string | undefined = undefined;

  if (userLat === undefined || userLng === undefined) {
    const resolved = await resolveLocation(parsed.locationKeyword || query, effectivePincode);
    if (resolved) {
      userLat = resolved.lat;
      userLng = resolved.lng;
      resolvedLocName = resolved.name;
    }
  }

  // 5. If location cannot be resolved, return clear error message asking for a more specific location
  if (userLat === undefined || userLng === undefined) {
    return {
      query,
      detectedLocation: null,
      category,
      requestedCount: requestedLimit,
      totalFound: 0,
      results: [],
      notice: `Could not identify the geographic location for "${query}". Please enter a more specific PIN code, area, landmark, or city name.`,
      isGoogleRoutingAvailable: false
    };
  }

  // 6. Calculate straight-line Haversine distance between searched coordinates and each eligible store
  interface QualifyingStore {
    store: Store;
    straightDistanceKm: number;
    reason: string;
  }

  const qualifyingStores: QualifyingStore[] = [];

  for (const store of allDatabaseStores) {
    // Exclude records with missing or invalid coordinates from geographic ranking
    if (
      store.latitude === null ||
      store.longitude === null ||
      isNaN(store.latitude) ||
      isNaN(store.longitude)
    ) {
      continue;
    }

    const straightDist = calculateHaversineDistance(
      userLat,
      userLng,
      store.latitude,
      store.longitude
    );

    // Filter stores strictly within 100 KM straight-line geographic radius
    if (straightDist <= radiusKm) {
      let reason = `${straightDist} km straight-line distance`;
      if (effectivePincode && store.pincode === effectivePincode) {
        reason = `PIN match (${store.pincode}) · ${straightDist} km away`;
      }

      qualifyingStores.push({
        store,
        straightDistanceKm: straightDist,
        reason
      });
    }
  }

  // 7. Sort strictly by ascending distance (nearest to farthest)
  qualifyingStores.sort((a, b) => a.straightDistanceKm - b.straightDistanceKm);

  // 8. Return top 3 nearest stores within the 100 KM radius (or all available if < 3)
  const shortlisted = qualifyingStores.slice(0, requestedLimit);

  // 9. Build final 14-point results with actual database fields & driving estimates
  const finalResults: StoreSearchResult[] = [];

  for (let i = 0; i < shortlisted.length; i++) {
    const item = shortlisted[i];
    const store = item.store;

    let travelMins: number | null = null;
    let traffic: 'Light traffic' | 'Moderate traffic' | 'Heavy traffic' | null = null;

    if (store.latitude && store.longitude) {
      const route = await calculateRoute(userLat, userLng, store.latitude, store.longitude);
      travelMins = route.travelTimeMinutes;
      traffic = route.trafficLevel;
    }

    const directionsUrl = store.latitude && store.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`
      : store.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.storeName)}`;

    const howToReach = `Follow navigation towards ${store.area || store.city}. Store is located at ${store.address}${store.landmark ? ', near ' + store.landmark : ''}.`;

    finalResults.push({
      store,
      rank: i + 1,
      isPreferred: i === 0,
      matchReason: item.reason,
      distanceKm: item.straightDistanceKm, // Straight-line geographic distance
      travelTimeMinutes: travelMins,
      trafficLevel: traffic,
      howToReach,
      directionsUrl
    });
  }

  // 10. Generate clear notice if no stores found within 100 KM or if fewer than requested limit
  let notice: string | undefined = undefined;
  const locationLabel = resolvedLocName || query.trim();

  if (finalResults.length === 0) {
    notice = `No ${category === 'Retail' ? 'iPlanet Retail Store' : 'iPlanet Care / Service Centre'} found within a 100 KM radius of ${locationLabel}.`;
  } else if (finalResults.length < requestedLimit) {
    notice = `Found ${finalResults.length} ${category === 'Retail' ? 'iPlanet Retail Store' : 'iPlanet Care / Service Centre'}${finalResults.length === 1 ? '' : 's'} within a 100 KM radius of ${locationLabel}.`;
  }

  return {
    query,
    detectedLocation: {
      name: resolvedLocName,
      latitude: userLat,
      longitude: userLng,
      pincode: effectivePincode
    },
    category,
    requestedCount: requestedLimit,
    totalFound: finalResults.length,
    results: finalResults,
    notice,
    isGoogleRoutingAvailable: !!process.env.GOOGLE_ROUTES_API_KEY
  };
}
