/** Validation of a store typed into the admin form (add and edit). Pure, so it can be tested. */
import type { Store, StoreStatus } from '@/types/store';

export const STORE_STATUSES: StoreStatus[] = ['Active', 'Inactive', 'TemporarilyClosed', 'ComingSoon'];
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown): number | null | 'bad' => {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 'bad';
};

export type StoreFields = Pick<Store, 'storeName' | 'address' | 'area' | 'locality' | 'city' | 'state' | 'pincode' | 'landmark' | 'latitude' | 'longitude' | 'phone' | 'contactPerson' | 'storeManager' | 'openingTime' | 'closingTime' | 'workingDays' | 'googleMapsUrl' | 'status'>;

/** Checks every editable field of a store. Required: name, address, city, 6-digit PIN. Coordinates must be both set or both empty. */
export function checkStoreFields(raw: unknown): { ok: true; value: StoreFields } | { ok: false; errors: string[] } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const storeName = s(r.storeName, 120);
  if (storeName.length < 3) errors.push('Enter the store name.');
  const address = s(r.address, 300);
  if (address.length < 5) errors.push('Enter the full address.');
  const city = s(r.city, 80);
  if (!city) errors.push('Enter the city.');
  const pincode = s(r.pincode, 10);
  if (!/^\d{6}$/.test(pincode)) errors.push('The PIN code must be 6 digits.');
  const lat = num(r.latitude);
  const lng = num(r.longitude);
  if (lat === 'bad' || (typeof lat === 'number' && (lat < -90 || lat > 90))) errors.push('Latitude must be a number between -90 and 90.');
  if (lng === 'bad' || (typeof lng === 'number' && (lng < -180 || lng > 180))) errors.push('Longitude must be a number between -180 and 180.');
  if ((lat === null) !== (lng === null)) errors.push('Enter both latitude and longitude, or leave both empty.');
  const status = s(r.status, 30) || 'Active';
  if (!STORE_STATUSES.includes(status as StoreStatus)) errors.push('Choose a valid status.');
  const maps = s(r.googleMapsUrl, 600);
  if (maps && !/^https?:\/\//i.test(maps)) errors.push('The Google Maps link must start with https://');
  const phone = s(r.phone, 30);
  if (phone && !/^[\d\s+()-]{6,30}$/.test(phone)) errors.push('Check the phone number.');
  if (errors.length) return { ok: false, errors };
  const latV = typeof lat === 'number' ? lat : null;
  const lngV = typeof lng === 'number' ? lng : null;
  return {
    ok: true,
    value: {
      storeName, address, city, pincode,
      area: s(r.area, 100) || null,
      locality: s(r.area, 100) || s(r.locality, 100) || null,
      state: s(r.state, 60) || 'Tamil Nadu',
      landmark: s(r.landmark, 150) || null,
      latitude: latV,
      longitude: lngV,
      phone: phone || null,
      contactPerson: s(r.contactPerson, 80) || null,
      storeManager: s(r.storeManager, 80) || null,
      openingTime: s(r.openingTime, 20) || null,
      closingTime: s(r.closingTime, 20) || null,
      workingDays: s(r.workingDays, 60) || null,
      googleMapsUrl: maps || (latV !== null && lngV !== null ? `https://www.google.com/maps/search/?api=1&query=${latV},${lngV}` : null),
      status: status as StoreStatus,
    },
  };
}
