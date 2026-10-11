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

/**
 * Calls Google Distance Matrix / Routes API only for shortlisted candidates to minimize API costs.
 * Falls back transparently to Haversine driving estimates if Google key is not present or limit reached.
 */
export async function calculateRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteInfo> {
  const routesKey = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

  if (routesKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&mode=driving&departure_time=now&key=${routesKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.rows && data.rows[0]?.elements && data.rows[0].elements[0]?.status === 'OK') {
        const elem = data.rows[0].elements[0];
        const distKm = Math.round((elem.distance.value / 1000) * 10) / 10;
        const durationSec = elem.duration_in_traffic ? elem.duration_in_traffic.value : elem.duration.value;
        const travelMinutes = Math.max(1, Math.round(durationSec / 60));

        let traffic: 'Light traffic' | 'Moderate traffic' | 'Heavy traffic' | null = null;
        if (elem.duration_in_traffic) {
          const ratio = elem.duration_in_traffic.value / elem.duration.value;
          if (ratio > 1.35) traffic = 'Heavy traffic';
          else if (ratio > 1.1) traffic = 'Moderate traffic';
          else traffic = 'Light traffic';
        }

        return {
          distanceKm: distKm,
          travelTimeMinutes: travelMinutes,
          trafficLevel: traffic,
          isLiveTraffic: !!elem.duration_in_traffic
        };
      }
    } catch (err) {
      console.warn('Google Routing API call failed, using internal calculation:', err);
    }
  }

  // Internal Fallback Estimation (City road factor ~1.25x Haversine, average speed 25-30 km/h)
  const straightDist = calculateHaversineDistance(originLat, originLng, destLat, destLng);
  const roadDist = Math.round(straightDist * 1.25 * 10) / 10;
  const minutes = Math.max(2, Math.round((roadDist / 28) * 60));

  return {
    distanceKm: roadDist,
    travelTimeMinutes: minutes,
    trafficLevel: null,
    isLiveTraffic: false
  };
}
