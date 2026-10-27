export interface RouteInfo {
  distanceKm: number;
  travelTimeMinutes: number;
  trafficLevel: 'Light traffic' | 'Moderate traffic' | 'Heavy traffic' | null;
  isLiveTraffic: boolean;
}

/**
 * Calculates straight line distance (in km) using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

type TrafficLevel = 'Light traffic' | 'Moderate traffic' | 'Heavy traffic' | null;

/** Road-distance estimate when no routing API answers: ~1.25x straight line at ~28 km/h city speed. */
function estimateRoute(originLat: number, originLng: number, destLat: number, destLng: number): RouteInfo {
  const straightDist = calculateHaversineDistance(originLat, originLng, destLat, destLng);
  const roadDist = Math.round(straightDist * 1.25 * 10) / 10;
  return {
    distanceKm: roadDist,
    travelTimeMinutes: Math.max(2, Math.round((roadDist / 28) * 60)),
    trafficLevel: null,
    isLiveTraffic: false,
  };
}

async function googleRoutes(
  originLat: number,
  originLng: number,
  destinations: { lat: number; lng: number }[],
  timeoutMs: number
): Promise<(RouteInfo | null)[] | null> {
  const routesKey = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!routesKey) return null;

  try {
    const dests = destinations.map(d => `${d.lat},${d.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${encodeURIComponent(dests)}&mode=driving&departure_time=now&key=${routesKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const data = await res.json();
    if (data.status !== 'OK' || !data.rows?.[0]?.elements) return null;

    return data.rows[0].elements.map((elem: any) => {
      if (elem?.status !== 'OK') return null;
      const durationSec = elem.duration_in_traffic ? elem.duration_in_traffic.value : elem.duration.value;
      let traffic: TrafficLevel = null;
      if (elem.duration_in_traffic) {
        const ratio = elem.duration_in_traffic.value / elem.duration.value;
        traffic = ratio > 1.35 ? 'Heavy traffic' : ratio > 1.1 ? 'Moderate traffic' : 'Light traffic';
      }
      return {
        distanceKm: Math.round((elem.distance.value / 1000) * 10) / 10,
        travelTimeMinutes: Math.max(1, Math.round(durationSec / 60)),
        trafficLevel: traffic,
        isLiveTraffic: !!elem.duration_in_traffic,
      };
    });
  } catch (err) {
    console.warn('Google Routing API call failed, using internal estimate:', err);
    return null;
  }
}

/**
 * Routes from one origin to every shortlisted store in a single batched call
 * (Ola Maps first, then Google), never one request per store. Any destination
 * a provider can't answer falls back to the internal estimate, so this always
 * returns one RouteInfo per destination within roughly `timeoutMs`.
 */
export async function calculateRoutes(
  originLat: number,
  originLng: number,
  destinations: { lat: number; lng: number }[],
  timeoutMs = 3000
): Promise<RouteInfo[]> {
  if (destinations.length === 0) return [];

  let provided: (RouteInfo | null)[] | null = null;

  const { getOlaDistances } = await import('./olaMaps');
  const ola = await getOlaDistances(originLat, originLng, destinations, timeoutMs);
  if (ola) {
    provided = ola.map(r =>
      r ? { distanceKm: r.distance_km, travelTimeMinutes: r.duration_minutes, trafficLevel: null, isLiveTraffic: false } : null
    );
  }

  if (!provided) {
    provided = await googleRoutes(originLat, originLng, destinations, timeoutMs);
  }

  return destinations.map((d, i) => provided?.[i] ?? estimateRoute(originLat, originLng, d.lat, d.lng));
}
