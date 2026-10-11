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
}

export async function searchStores(options: SearchOptions): Promise<SearchResponse> {
  const { query, latitude, longitude, pincode: directPincode, limit: directLimit, storeCategory: directCategory } = options;
  const parsed = parseNaturalQuery(query || '');

  // 1. Determine Store Category: Default to Retail unless explicitly requested
  const category: StoreCategory = directCategory || (parsed.isCareIntent ? 'Care' : 'Retail');

  // Load stores from repository (retail_stores or care_centres)
  const allCandidateStores = getAllStores(category).filter(s => s.status === 'Active');

  const requestedCount = directLimit || parsed.requestedCount || 3;
  const effectivePincode = directPincode || parsed.pincodeMatch;

  // 2. Priority 1: Exact POS Code Match
  if (parsed.posCodeMatch) {
    const cleanSearchPos = parsed.posCodeMatch.replace(/\s+/g, '').toUpperCase();
    const exactMatch = allCandidateStores.find(
      s => s.posCode.replace(/\s+/g, '').toUpperCase() === cleanSearchPos
    );

    if (exactMatch) {
      const directionsUrl = exactMatch.latitude && exactMatch.longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${exactMatch.latitude},${exactMatch.longitude}`
        : exactMatch.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exactMatch.storeName)}`;

      return {
        query,
        detectedLocation: { name: `POS Code ${exactMatch.posCode}` },
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
            howToReach: `Located at ${exactMatch.address}. ${exactMatch.landmark ? 'Landmark: ' + exactMatch.landmark + '.' : ''}`,
            directionsUrl
          }
        ],
        isGoogleRoutingAvailable: false
      };
    }
  }

  // 3. Resolve Customer Coordinates
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

  // 4. Score and Rank stores based on specification hierarchy
  interface ScoredStore {
    store: Store;
    score: number;
    straightDistance: number | null;
    reason: string;
  }

  const scoredList: ScoredStore[] = [];
  const queryLower = (parsed.locationKeyword || query).toLowerCase().trim();

  // Check if a specific city was mentioned in the query
  const knownCities = ['chennai', 'bengaluru', 'bangalore', 'coimbatore', 'madurai', 'salem', 'trichy', 'tiruchirappalli', 'puducherry', 'pondicherry', 'mangalore', 'mangaluru', 'kochi', 'vellore', 'thanjavur', 'tanjore', 'tirunelveli', 'thoothukudi', 'nagercoil', 'kannur', 'trivandrum'];
  const matchedCity = knownCities.find(c => queryLower.includes(c));

  for (const store of allCandidateStores) {
    let score = 0;
    const reasons: string[] = [];

    // Exact PIN match (Priority 2)
    if (effectivePincode && store.pincode === effectivePincode) {
      score += 5000;
      reasons.push(`Exact PIN code match (${store.pincode})`);
    }

    // Locality / Area match (Priority 3)
    if (store.area && queryLower && (store.area.toLowerCase().includes(queryLower) || queryLower.includes(store.area.toLowerCase()))) {
      score += 3000;
      reasons.push(`Area match (${store.area})`);
    }

    // Landmark match (Priority 4)
    if (store.landmark && queryLower && store.landmark.toLowerCase().includes(queryLower)) {
      score += 2000;
      reasons.push(`Landmark proximity (${store.landmark})`);
    }

    // City match (Priority 5)
    if (store.city && queryLower && (store.city.toLowerCase().includes(queryLower) || queryLower.includes(store.city.toLowerCase()))) {
      score += 1500;
      reasons.push(`City match (${store.city})`);
    }

    // Full Address keyword match
    if (queryLower && store.address.toLowerCase().includes(queryLower)) {
      score += 1000;
    }

    // Geographic Distance Scoring (Priority 6)
    let straightDist: number | null = null;
    if (userLat !== undefined && userLng !== undefined && store.latitude && store.longitude) {
      straightDist = calculateHaversineDistance(userLat, userLng, store.latitude, store.longitude);
      // Stores closer receive higher scores
      if (straightDist < 5) {
        score += Math.max(0, 3000 - straightDist * 100);
      } else if (straightDist < 15) {
        score += Math.max(0, 2000 - straightDist * 50);
      } else if (straightDist < 45) {
        score += Math.max(0, 1000 - straightDist * 15);
      } else if (straightDist < 75) {
        score += Math.max(0, 400 - straightDist * 4);
      }
    }

    // Candidate inclusion filter:
    // If a specific city was searched (e.g. Bangalore), only include stores matching that city OR within 60km
    if (matchedCity) {
      const storeCityLower = (store.city || '').toLowerCase();
      const isSameCity = storeCityLower.includes(matchedCity) ||
        (matchedCity === 'bangalore' && storeCityLower.includes('bengaluru')) ||
        (matchedCity === 'bengaluru' && storeCityLower.includes('bangalore'));

      if (isSameCity || (straightDist !== null && straightDist < 60)) {
        scoredList.push({
          store,
          score: score > 0 ? score : 500,
          straightDistance: straightDist,
          reason: reasons[0] || (straightDist ? `Approx. ${straightDist} km away` : 'City location match')
        });
      }
    } else {
      // General location or coordinates search: include if scored or within 65km commute
      if (score > 0 || (straightDist !== null && straightDist < 65)) {
        scoredList.push({
          store,
          score,
          straightDistance: straightDist,
          reason: reasons[0] || (straightDist ? `Approx. ${straightDist} km away` : 'Nearby store')
        });
      }
    }
  }

  // Sort descending by score, then ascending by distance
  scoredList.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.straightDistance !== null && b.straightDistance !== null) {
      return a.straightDistance - b.straightDistance;
    }
    return 0;
  });

  // Shortlist candidates up to requested count
  const shortlisted = scoredList.slice(0, requestedCount);

  // If no candidates found through scoring/filtering, fallback to nearest stores within 80km
  if (shortlisted.length === 0 && userLat !== undefined && userLng !== undefined) {
    const fallbackSorted = allCandidateStores
      .filter(s => s.latitude && s.longitude)
      .map(s => ({
        store: s,
        score: 10,
        straightDistance: calculateHaversineDistance(userLat!, userLng!, s.latitude!, s.longitude!),
        reason: 'Nearest available store'
      }))
      .filter(s => s.straightDistance !== null && s.straightDistance < 80)
      .sort((a, b) => (a.straightDistance || 0) - (b.straightDistance || 0))
      .slice(0, requestedCount);

    shortlisted.push(...fallbackSorted);
  }

  // 5. Calculate driving routes and travel time for shortlisted stores
  const finalResults: StoreSearchResult[] = [];

  for (let i = 0; i < shortlisted.length; i++) {
    const item = shortlisted[i];
    const store = item.store;
    let distKm: number | null = item.straightDistance;
    let travelMins: number | null = null;
    let traffic: 'Light traffic' | 'Moderate traffic' | 'Heavy traffic' | null = null;

    if (userLat !== undefined && userLng !== undefined && store.latitude && store.longitude) {
      const route = await calculateRoute(userLat, userLng, store.latitude, store.longitude);
      distKm = route.distanceKm;
      travelMins = route.travelTimeMinutes;
      traffic = route.trafficLevel;
    }

    const directionsUrl = store.latitude && store.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`
      : store.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.storeName)}`;

    const howToReach = userLat !== undefined
      ? `Follow the navigation via Google Maps towards ${store.area || store.city}. The store is located at ${store.address}${store.landmark ? ', near ' + store.landmark : ''}.`
      : `Visit ${store.address}${store.landmark ? ', near ' + store.landmark : ''}. Open 10:00 AM – 09:30 PM.`;

    finalResults.push({
      store,
      rank: i + 1,
      isPreferred: i === 0,
      matchReason: item.reason,
      distanceKm: distKm,
      travelTimeMinutes: travelMins,
      trafficLevel: traffic,
      howToReach,
      directionsUrl
    });
  }

  // Contextual informational notice
  let notice: string | undefined = undefined;
  if (effectivePincode && finalResults.length > 0 && finalResults[0].store.pincode !== effectivePincode) {
    notice = `No direct store in PIN ${effectivePincode}. Showing nearest stores ranked by proximity.`;
  } else if (matchedCity && finalResults.length > 0 && finalResults.length < requestedCount) {
    notice = `Showing all ${finalResults.length} official iPlanet ${category} store${finalResults.length === 1 ? '' : 's'} available in the ${finalResults[0].store.city} area.`;
  } else if (finalResults.length === 0) {
    notice = `No official iPlanet ${category} stores found in this location. iPlanet operates across Tamil Nadu, Karnataka, Kerala, and Puducherry.`;
  }

  return {
    query,
    detectedLocation: userLat !== undefined && userLng !== undefined ? {
      name: resolvedLocName,
      latitude: userLat,
      longitude: userLng,
      pincode: effectivePincode
    } : null,
    category,
    requestedCount,
    totalFound: finalResults.length,
    results: finalResults,
    notice,
    isGoogleRoutingAvailable: !!process.env.GOOGLE_ROUTES_API_KEY
  };
}
