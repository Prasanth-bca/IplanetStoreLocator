/**
 * Ola Maps Integration for iPlanet Store Locator
 *
 * Ola Maps provides:
 * - Free tier: 100,000 API calls/month at ₹0
 * - India-focused mapping and routing
 * - Distance Matrix API for multiple origin-destination pairs
 *
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

/**
 * Calls Ola Maps Distance Matrix API to get real distance & travel time
 * Falls back to Haversine if API key not configured or call fails
 */
export async function getOlaDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<OlaDistanceMatrixResult | null> {
  const apiKey = process.env.OLA_MAPS_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    // Ola Maps Distance Matrix API endpoint
    const url = 'https://api.olamaps.io/routing/v1/distanceMatrix';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sources: [
          {
            latitude: originLat,
            longitude: originLng,
          }
        ],
        destinations: [
          {
            latitude: destLat,
            longitude: destLng,
          }
        ],
        region: 'IN', // India region
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`Ola Maps API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    // Check if we have valid results
    if (
      data.code === 'Ok' &&
      data.data?.rows &&
      data.data.rows[0]?.elements &&
      data.data.rows[0].elements[0]
    ) {
      const element = data.data.rows[0].elements[0];

      if (element.status === 'Ok' && element.distance && element.duration) {
        const distanceKm = Math.round((element.distance / 1000) * 10) / 10;
        const durationMinutes = Math.max(1, Math.round(element.duration / 60));

        return {
          distance_km: distanceKm,
          duration_minutes: durationMinutes,
          isRealData: true,
        };
      }
    }

    console.warn('Ola Maps Distance Matrix returned no valid results:', data);
    return null;
  } catch (error) {
    console.warn('Ola Maps Distance Matrix API call failed:', error);
    return null;
  }
}

/**
 * Calls Ola Maps Autocomplete API for location geocoding
 */
export async function getOlaGeocoding(
  query: string
): Promise<OlaGeocodingResult | null> {
  const apiKey = process.env.OLA_MAPS_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const autocompleteUrl = 'https://api.olamaps.io/places/v1/autocomplete';

    const response = await fetch(autocompleteUrl, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: query,
        region: 'IN', // India region
        limit: 1,
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      console.warn(`Ola Maps Autocomplete error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.predictions && data.predictions.length > 0) {
      const prediction = data.predictions[0];

      // Get detailed coordinates via place details API
      if (prediction.place_id) {
        const detailsUrl = 'https://api.olamaps.io/places/v1/details';
        const detailsResponse = await fetch(detailsUrl, {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            place_id: prediction.place_id,
          }),
          signal: AbortSignal.timeout(4000),
        });

        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();

          if (detailsData.result?.geometry?.location) {
            const location = detailsData.result.geometry.location;

            return {
              lat: location.lat,
              lng: location.lng,
              name: prediction.description || prediction.main_text,
              city: detailsData.result.formatted_address?.split(',')[1]?.trim(),
              area: prediction.main_text,
            };
          }
        }
      }

      // Fallback: If no place_id or details fail, still return if we have coordinates
      if (prediction.geometry?.location) {
        return {
          lat: prediction.geometry.location.lat,
          lng: prediction.geometry.location.lng,
          name: prediction.description || prediction.main_text,
          area: prediction.main_text,
        };
      }
    }

    return null;
  } catch (error) {
    console.warn('Ola Maps Geocoding failed:', error);
    return null;
  }
}
