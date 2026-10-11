export type StoreStatus = 'Active' | 'Inactive' | 'TemporarilyClosed' | 'ComingSoon';
export type StoreCategory = 'Retail' | 'Care';

export interface Store {
  id: string;
  posCode: string;
  storeName: string;
  storeType: string;
  category: StoreCategory;
  brand: string;
  address: string;
  area: string | null;
  locality: string | null;
  city: string;
  state: string;
  country: string;
  pincode: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  contactPerson: string | null;
  storeManager?: string | null;
  openingTime: string | null;
  closingTime: string | null;
  workingDays: string | null;
  googlePlaceId: string | null;
  googleMapsUrl: string | null;
  status: StoreStatus;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSearchResult {
  store: Store;
  rank: number;
  isPreferred: boolean;
  matchReason: string;
  distanceKm: number | null;
  travelTimeMinutes: number | null;
  trafficLevel: 'Light traffic' | 'Moderate traffic' | 'Heavy traffic' | null;
  howToReach: string;
  directionsUrl: string;
}

export interface SearchResponse {
  query: string;
  detectedLocation: {
    name?: string;
    latitude?: number;
    longitude?: number;
    pincode?: string;
    city?: string;
  } | null;
  category: StoreCategory;
  requestedCount: number;
  totalFound: number;
  results: StoreSearchResult[];
  notice?: string;
  isGoogleRoutingAvailable: boolean;
}

export interface ParsedQuery {
  raw: string;
  isCareIntent: boolean;
  posCodeMatch?: string;
  pincodeMatch?: string;
  requestedCount?: number;
  locationKeyword: string;
}
