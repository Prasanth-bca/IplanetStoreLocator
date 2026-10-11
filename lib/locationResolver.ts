// Comprehensive index of prominent South Indian areas, cities and landmarks
// Used for instantaneous zero-latency local geocoding
const KNOWN_GEO_INDEX: Record<string, { lat: number; lng: number; city: string; area: string }> = {
  // ─── Bengaluru Landmarks & Localities ───
  'electronic city': { lat: 12.8452, lng: 77.6602, city: 'Bengaluru', area: 'Electronic City' },
  'electronic city phase 1': { lat: 12.8452, lng: 77.6602, city: 'Bengaluru', area: 'Electronic City' },
  'electronic city phase 2': { lat: 12.8398, lng: 77.6775, city: 'Bengaluru', area: 'Electronic City' },
  'whitefield': { lat: 12.9698, lng: 77.7499, city: 'Bengaluru', area: 'Whitefield' },
  'ashoka pillar': { lat: 12.9388, lng: 77.5831, city: 'Bengaluru', area: 'Jayanagar' },
  'hsr': { lat: 12.9121, lng: 77.6446, city: 'Bengaluru', area: 'HSR Layout' },
  'hsr layout': { lat: 12.9121, lng: 77.6446, city: 'Bengaluru', area: 'HSR Layout' },
  'indiranagar': { lat: 12.9719, lng: 77.6412, city: 'Bengaluru', area: 'Indiranagar' },
  '100 feet road indiranagar': { lat: 12.9719, lng: 77.6412, city: 'Bengaluru', area: 'Indiranagar' },
  'koramangala': { lat: 12.9352, lng: 77.6245, city: 'Bengaluru', area: 'Koramangala' },
  'phoenix marketcity bangalore': { lat: 12.9961, lng: 77.6974, city: 'Bengaluru', area: 'Mahadevapura' },
  'phoenix mall bangalore': { lat: 12.9961, lng: 77.6974, city: 'Bengaluru', area: 'Mahadevapura' },
  'phoenix mall': { lat: 12.9961, lng: 77.6974, city: 'Bengaluru', area: 'Mahadevapura' },
  'royal meenakshi mall': { lat: 12.8752, lng: 77.5959, city: 'Bengaluru', area: 'Bannerghatta Road' },
  'bannerghatta road': { lat: 12.8752, lng: 77.5959, city: 'Bengaluru', area: 'Bannerghatta Road' },
  'bellandur': { lat: 12.9304, lng: 77.6784, city: 'Bengaluru', area: 'Bellandur' },
  'marathahalli': { lat: 12.9591, lng: 77.6974, city: 'Bengaluru', area: 'Marathahalli' },
  'sarjapur road': { lat: 12.9165, lng: 77.6744, city: 'Bengaluru', area: 'Sarjapur Road' },
  'sarjapur': { lat: 12.8597, lng: 77.7885, city: 'Bengaluru', area: 'Sarjapur' },
  'btm layout': { lat: 12.9166, lng: 77.6101, city: 'Bengaluru', area: 'BTM Layout' },
  'btm': { lat: 12.9166, lng: 77.6101, city: 'Bengaluru', area: 'BTM Layout' },
  'jp nagar': { lat: 12.9063, lng: 77.5857, city: 'Bengaluru', area: 'JP Nagar' },
  'jayanagar': { lat: 12.9308, lng: 77.5838, city: 'Bengaluru', area: 'Jayanagar' },
  'malleshwaram': { lat: 13.0031, lng: 77.5643, city: 'Bengaluru', area: 'Malleshwaram' },
  'rajajinagar': { lat: 12.9982, lng: 77.5530, city: 'Bengaluru', area: 'Rajajinagar' },
  'nagarbhavi': { lat: 12.9602, lng: 77.5108, city: 'Bengaluru', area: 'Nagarbhavi' },
  'hebbal': { lat: 13.0358, lng: 77.5970, city: 'Bengaluru', area: 'Hebbal' },
  'yelahanka': { lat: 13.1007, lng: 77.5963, city: 'Bengaluru', area: 'Yelahanka' },
  'mg road bangalore': { lat: 12.9756, lng: 77.6066, city: 'Bengaluru', area: 'MG Road' },
  'bengaluru': { lat: 12.9716, lng: 77.5946, city: 'Bengaluru', area: 'Bengaluru Central' },
  'bangalore': { lat: 12.9716, lng: 77.5946, city: 'Bengaluru', area: 'Bengaluru Central' },

  // ─── Chennai Landmarks & Localities ───
  'marina beach': { lat: 13.0499, lng: 80.2824, city: 'Chennai', area: 'Marina Beach' },
  'marina beach chennai': { lat: 13.0499, lng: 80.2824, city: 'Chennai', area: 'Marina Beach' },
  'guindy': { lat: 13.0067, lng: 80.2025, city: 'Chennai', area: 'Guindy' },
  'guindy chennai': { lat: 13.0067, lng: 80.2025, city: 'Chennai', area: 'Guindy' },
  'st. thomas mount': { lat: 13.0033, lng: 80.1983, city: 'Chennai', area: 'St. Thomas Mount' },
  'st thomas mount': { lat: 13.0033, lng: 80.1983, city: 'Chennai', area: 'St. Thomas Mount' },
  'pondy bazaar': { lat: 13.0406, lng: 80.2346, city: 'Chennai', area: 'T. Nagar' },
  't nagar': { lat: 13.0418, lng: 80.2341, city: 'Chennai', area: 'T. Nagar' },
  't.nagar': { lat: 13.0418, lng: 80.2341, city: 'Chennai', area: 'T. Nagar' },
  'mogappair west': { lat: 13.0837, lng: 80.1747, city: 'Chennai', area: 'Mogappair West' },
  'mogappair': { lat: 13.0837, lng: 80.1747, city: 'Chennai', area: 'Mogappair' },
  'valasaravakkam': { lat: 13.0437, lng: 80.1680, city: 'Chennai', area: 'Valasaravakkam' },
  'selaiyur': { lat: 12.9165, lng: 80.1462, city: 'Chennai', area: 'Selaiyur' },
  'tambaram': { lat: 12.9249, lng: 80.1000, city: 'Chennai', area: 'Tambaram' },
  'tambaram sanatorium': { lat: 12.9366, lng: 80.1250, city: 'Chennai', area: 'Tambaram Sanatorium' },
  'chromepet': { lat: 12.9516, lng: 80.1409, city: 'Chennai', area: 'Chromepet' },
  'pallavaram': { lat: 12.9675, lng: 80.1491, city: 'Chennai', area: 'Pallavaram' },
  'thoraipakkam': { lat: 12.9416, lng: 80.2362, city: 'Chennai', area: 'OMR' },
  'omr': { lat: 12.9416, lng: 80.2362, city: 'Chennai', area: 'OMR' },
  'sholinganallur': { lat: 12.9010, lng: 80.2279, city: 'Chennai', area: 'Sholinganallur' },
  'velachery': { lat: 12.9815, lng: 80.2180, city: 'Chennai', area: 'Velachery' },
  'phoenix marketcity chennai': { lat: 12.9918, lng: 80.2173, city: 'Chennai', area: 'Velachery' },
  'adyar': { lat: 13.0012, lng: 80.2565, city: 'Chennai', area: 'Adyar' },
  'besant nagar': { lat: 13.0003, lng: 80.2667, city: 'Chennai', area: 'Besant Nagar' },
  'anna nagar': { lat: 13.0850, lng: 80.2101, city: 'Chennai', area: 'Anna Nagar' },
  'alwarpet': { lat: 13.0336, lng: 80.2504, city: 'Chennai', area: 'Alwarpet' },
  'nungambakkam': { lat: 13.0569, lng: 80.2425, city: 'Chennai', area: 'Nungambakkam' },
  'koyambedu': { lat: 13.0694, lng: 80.1948, city: 'Chennai', area: 'Koyambedu' },
  'porur': { lat: 13.0359, lng: 80.1567, city: 'Chennai', area: 'Porur' },
  'avadi': { lat: 13.1147, lng: 80.0960, city: 'Chennai', area: 'Avadi' },
  'triplicane': { lat: 13.0569, lng: 80.2798, city: 'Chennai', area: 'Triplicane' },
  'mylapore': { lat: 13.0368, lng: 80.2676, city: 'Chennai', area: 'Mylapore' },
  'chennai': { lat: 13.0827, lng: 80.2707, city: 'Chennai', area: 'Chennai' },

  // ─── Coimbatore Landmarks & Localities ───
  'saravanampatti': { lat: 11.0797, lng: 76.9997, city: 'Coimbatore', area: 'Saravanampatti' },
  'saravanampatti coimbatore': { lat: 11.0797, lng: 76.9997, city: 'Coimbatore', area: 'Saravanampatti' },
  'peelamedu': { lat: 11.0289, lng: 77.0015, city: 'Coimbatore', area: 'Peelamedu' },
  'hopes college': { lat: 11.0267, lng: 77.0125, city: 'Coimbatore', area: 'Hopes College' },
  'rs puram': { lat: 11.0068, lng: 76.9557, city: 'Coimbatore', area: 'RS Puram' },
  'gandhipuram': { lat: 11.0168, lng: 76.9653, city: 'Coimbatore', area: 'Gandhipuram' },
  'brookefields mall': { lat: 11.0090, lng: 76.9594, city: 'Coimbatore', area: 'Brookefields' },
  'brookefields': { lat: 11.0090, lng: 76.9594, city: 'Coimbatore', area: 'Brookefields' },
  'prozone mall': { lat: 11.0556, lng: 76.9941, city: 'Coimbatore', area: 'Prozone Mall' },
  'ramanathapuram coimbatore': { lat: 10.9986, lng: 76.9997, city: 'Coimbatore', area: 'Ramanathapuram' },
  'singanallur': { lat: 10.9992, lng: 77.0278, city: 'Coimbatore', area: 'Singanallur' },
  'saibaba colony': { lat: 11.0247, lng: 76.9452, city: 'Coimbatore', area: 'Saibaba Colony' },
  'coimbatore': { lat: 11.0168, lng: 76.9558, city: 'Coimbatore', area: 'Coimbatore' },

  // ─── Madurai ───
  'simmakkal': { lat: 9.9241, lng: 78.1166, city: 'Madurai', area: 'Simmakkal' },
  'kk nagar madurai': { lat: 9.9322, lng: 78.1481, city: 'Madurai', area: 'KK Nagar' },
  'goripalayam': { lat: 9.9298, lng: 78.1311, city: 'Madurai', area: 'Goripalayam' },
  'mattuthavani': { lat: 9.9442, lng: 78.1568, city: 'Madurai', area: 'Mattuthavani' },
  'madurai': { lat: 9.9252, lng: 78.1198, city: 'Madurai', area: 'Madurai' },

  // ─── Salem ───
  'meyyanur': { lat: 11.6685, lng: 78.1328, city: 'Salem', area: 'Meyyanur' },
  'fairlands': { lat: 11.6744, lng: 78.1420, city: 'Salem', area: 'Fairlands' },
  'salem junction': { lat: 11.6703, lng: 78.1275, city: 'Salem', area: 'Salem Junction' },
  'salem': { lat: 11.6643, lng: 78.1460, city: 'Salem', area: 'Salem' },

  // ─── Trichy ───
  'thillai nagar': { lat: 10.8267, lng: 78.6865, city: 'Trichy', area: 'Thillai Nagar' },
  'cantonment trichy': { lat: 10.8066, lng: 78.6867, city: 'Trichy', area: 'Cantonment' },
  'tiruchirappalli': { lat: 10.7905, lng: 78.7047, city: 'Trichy', area: 'Trichy' },
  'trichy': { lat: 10.7905, lng: 78.7047, city: 'Trichy', area: 'Trichy' },

  // ─── Puducherry ───
  'white town puducherry': { lat: 11.9325, lng: 79.8358, city: 'Puducherry', area: 'White Town' },
  'puducherry': { lat: 11.9416, lng: 79.8083, city: 'Puducherry', area: 'Puducherry' },
  'pondicherry': { lat: 11.9416, lng: 79.8083, city: 'Puducherry', area: 'Puducherry' },

  // ─── Mangalore & Manipal ───
  'hampankatta': { lat: 12.8682, lng: 74.8427, city: 'Mangalore', area: 'Hampankatta' },
  'kadri': { lat: 12.8872, lng: 74.8569, city: 'Mangalore', area: 'Kadri' },
  'mangalore': { lat: 12.9141, lng: 74.8560, city: 'Mangalore', area: 'Mangalore' },
  'mangaluru': { lat: 12.9141, lng: 74.8560, city: 'Mangalore', area: 'Mangalore' },
  'manipal': { lat: 13.3525, lng: 74.7927, city: 'Manipal', area: 'Manipal' },

  // ─── Kerala ───
  'kochi': { lat: 9.9312, lng: 76.2673, city: 'Kochi', area: 'Kochi' },
  'edappally': { lat: 10.0236, lng: 76.3116, city: 'Kochi', area: 'Edappally' },
  'lulu mall kochi': { lat: 10.0279, lng: 76.3080, city: 'Kochi', area: 'Edappally' },
  'kannur': { lat: 11.8745, lng: 75.3704, city: 'Kannur', area: 'Kannur' },
  'trivandrum': { lat: 8.5241, lng: 76.9366, city: 'Trivandrum', area: 'Trivandrum' },
  'thiruvananthapuram': { lat: 8.5241, lng: 76.9366, city: 'Trivandrum', area: 'Trivandrum' },

  // ─── Other Master Tamil Nadu Cities ───
  'thanjavur': { lat: 10.7870, lng: 79.1378, city: 'Tanjore', area: 'Thanjavur' },
  'tanjore': { lat: 10.7870, lng: 79.1378, city: 'Tanjore', area: 'Thanjavur' },
  'vellore': { lat: 12.9165, lng: 79.1325, city: 'Vellore', area: 'Vellore' },
  'tiruppur': { lat: 11.1085, lng: 77.3411, city: 'Tiruppur', area: 'Tiruppur' },
  'nagercoil': { lat: 8.1833, lng: 77.4119, city: 'Nagercoil', area: 'Nagercoil' },
  'tirunelveli': { lat: 8.7139, lng: 77.7567, city: 'Tirunelveli', area: 'Tirunelveli' },
  'thoothukudi': { lat: 8.7642, lng: 78.1348, city: 'Thoothukudi', area: 'Thoothukudi' },
};

// Known PIN code database
const PIN_INDEX: Record<string, { lat: number; lng: number; city: string; area: string }> = {
  '600016': { lat: 13.0033, lng: 80.1983, city: 'Chennai', area: 'St. Thomas Mount / Guindy' },
  '600017': { lat: 13.0406, lng: 80.2346, city: 'Chennai', area: 'Pondy Bazaar, T. Nagar' },
  '600037': { lat: 13.0837, lng: 80.1747, city: 'Chennai', area: 'Mogappair West' },
  '600087': { lat: 13.0437, lng: 80.1680, city: 'Chennai', area: 'Valasaravakkam' },
  '600073': { lat: 12.9165, lng: 80.1462, city: 'Chennai', area: 'Selaiyur, Tambaram' },
  '600097': { lat: 12.9416, lng: 80.2362, city: 'Chennai', area: 'Thoraipakkam, OMR' },
  '600054': { lat: 13.1147, lng: 80.0960, city: 'Chennai', area: 'Avadi' },
  '600005': { lat: 13.0569, lng: 80.2798, city: 'Chennai', area: 'Triplicane' },
  '600032': { lat: 13.0067, lng: 80.2025, city: 'Chennai', area: 'Guindy' },
  '600040': { lat: 13.0850, lng: 80.2101, city: 'Chennai', area: 'Anna Nagar' },
  '600020': { lat: 13.0012, lng: 80.2565, city: 'Chennai', area: 'Adyar' },
  '600090': { lat: 13.0003, lng: 80.2667, city: 'Chennai', area: 'Besant Nagar' },
  '600100': { lat: 12.9180, lng: 80.1950, city: 'Chennai', area: 'Medavakkam' },
  '560038': { lat: 12.9719, lng: 77.6412, city: 'Bengaluru', area: 'Indiranagar' },
  '560066': { lat: 12.9698, lng: 77.7499, city: 'Bengaluru', area: 'Whitefield' },
  '560102': { lat: 12.9121, lng: 77.6446, city: 'Bengaluru', area: 'HSR Layout' },
  '560076': { lat: 12.8752, lng: 77.5959, city: 'Bengaluru', area: 'Bannerghatta Road' },
  '560100': { lat: 12.8452, lng: 77.6602, city: 'Bengaluru', area: 'Electronic City' },
  '560034': { lat: 12.9352, lng: 77.6245, city: 'Bengaluru', area: 'Koramangala' },
  '560103': { lat: 12.9304, lng: 77.6784, city: 'Bengaluru', area: 'Bellandur' },
  '641002': { lat: 11.0068, lng: 76.9557, city: 'Coimbatore', area: 'RS Puram' },
  '641012': { lat: 11.0168, lng: 76.9653, city: 'Coimbatore', area: 'Gandhipuram' },
  '641001': { lat: 11.0090, lng: 76.9594, city: 'Coimbatore', area: 'Brookefields' },
  '641045': { lat: 10.9986, lng: 76.9997, city: 'Coimbatore', area: 'Ramanathapuram' },
  '641035': { lat: 11.0797, lng: 76.9997, city: 'Coimbatore', area: 'Saravanampatti / Prozone Mall' },
  '625001': { lat: 9.9241, lng: 78.1166, city: 'Madurai', area: 'Simmakkal' },
  '636004': { lat: 11.6685, lng: 78.1328, city: 'Salem', area: 'Meyyanur' },
};

// Memory cache for runtime geocoded queries
const runtimeGeoCache = new Map<string, { lat: number; lng: number; name: string }>();

export async function resolveLocation(
  query: string,
  pincode?: string
): Promise<{ lat: number; lng: number; city?: string; area?: string; name: string } | null> {
  const cacheKey = (pincode || query).trim().toLowerCase();
  if (runtimeGeoCache.has(cacheKey)) {
    return runtimeGeoCache.get(cacheKey)!;
  }

  // 1. Check exact pincode cache/database
  if (pincode && PIN_INDEX[pincode]) {
    const p = PIN_INDEX[pincode];
    const res = { lat: p.lat, lng: p.lng, city: p.city, area: p.area, name: `${p.area || p.city} (PIN ${pincode})` };
    runtimeGeoCache.set(cacheKey, res);
    return res;
  }

  // 2. Check known landmark/area index (ORDERED BY LENGTH DESCENDING to match specific landmarks first)
  const clean = query.trim().toLowerCase();
  const sortedKeys = Object.keys(KNOWN_GEO_INDEX).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (clean.includes(key)) {
      const val = KNOWN_GEO_INDEX[key];
      const res = {
        lat: val.lat,
        lng: val.lng,
        city: val.city,
        area: val.area,
        name: val.area ? `${val.area}, ${val.city}` : val.city,
      };
      runtimeGeoCache.set(cacheKey, res);
      return res;
    }
  }

  // 3. Google Geocoding API if key configured
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + ', India')}&key=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const first = data.results[0];
        const lat = first.geometry.location.lat;
        const lng = first.geometry.location.lng;
        const resultObj = {
          lat,
          lng,
          name: first.formatted_address,
        };
        runtimeGeoCache.set(cacheKey, resultObj);
        return resultObj;
      }
    } catch (err) {
      console.warn('Google Geocoding API call error:', err);
    }
  }

  // 4. Live Real Geocoder Fallback (OSM Nominatim for any location across India)
  try {
    const searchTarget = pincode || query;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchTarget + ', India')}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'iPlanetAIStoreLocator/1.0' },
      signal: AbortSignal.timeout(4000), // 4 second timeout
    });
    const list = await res.json();
    if (Array.isArray(list) && list.length > 0) {
      const item = list[0];
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        const resultObj = {
          lat,
          lng,
          name: item.display_name.split(',').slice(0, 3).join(', '),
        };
        runtimeGeoCache.set(cacheKey, resultObj);
        return resultObj;
      }
    }
  } catch (err) {
    console.warn('Live geocoder fallback error/timeout:', err);
  }

  return null;
}
