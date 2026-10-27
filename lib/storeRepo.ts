import { Store, StoreCategory } from '@/types/store';
import { prisma } from '@/lib/prisma';

function mapToStore(row: {
  id: string;
  posCode: string;
  storeName: string;
  storeType: string;
  category: string;
  locationType: string;
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
  storeManager: string | null;
  openingTime: string | null;
  closingTime: string | null;
  workingDays: string | null;
  googlePlaceId: string | null;
  googleMapsUrl: string | null;
  status: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}): Store {
  return {
    id: row.id,
    posCode: row.posCode,
    storeName: row.storeName,
    storeType: row.storeType,
    category: row.category as Store['category'],
    locationType: row.locationType as Store['locationType'],
    brand: row.brand,
    address: row.address,
    area: row.area,
    locality: row.locality,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    landmark: row.landmark,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    contactPerson: row.contactPerson,
    storeManager: row.storeManager,
    openingTime: row.openingTime,
    closingTime: row.closingTime,
    workingDays: row.workingDays,
    googlePlaceId: row.googlePlaceId,
    googleMapsUrl: row.googleMapsUrl,
    status: row.status as Store['status'],
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function getRetailStores(): Promise<Store[]> {
  const rows = await prisma.store.findMany({
    where: { category: 'Retail' },
    orderBy: [{ priority: 'asc' }, { storeName: 'asc' }]
  });
  return rows.map(mapToStore);
}

export async function saveRetailStores(stores: Store[]): Promise<void> {
  await upsertStores(stores);
}

export async function getCareCentres(): Promise<Store[]> {
  const rows = await prisma.store.findMany({
    where: { category: 'Care' },
    orderBy: [{ priority: 'asc' }, { storeName: 'asc' }]
  });
  return rows.map(mapToStore);
}

export async function saveCareCentres(centres: Store[]): Promise<void> {
  await upsertStores(centres);
}

async function upsertStores(stores: Store[]): Promise<void> {
  await prisma.$transaction(
    stores.map(s =>
      prisma.store.upsert({
        where: { id: s.id },
        create: {
          id: s.id,
          posCode: s.posCode,
          storeName: s.storeName,
          storeType: s.storeType || 'Retail',
          category: s.category || 'Retail',
          locationType: s.locationType || 'iPlanet Retail Store',
          brand: s.brand || 'iPlanet',
          address: s.address,
          area: s.area,
          locality: s.locality,
          city: s.city,
          state: s.state,
          country: s.country || 'India',
          pincode: s.pincode,
          landmark: s.landmark,
          latitude: s.latitude,
          longitude: s.longitude,
          phone: s.phone,
          contactPerson: s.contactPerson,
          storeManager: s.storeManager,
          openingTime: s.openingTime,
          closingTime: s.closingTime,
          workingDays: s.workingDays,
          googlePlaceId: s.googlePlaceId,
          googleMapsUrl: s.googleMapsUrl,
          status: s.status || 'Active',
          priority: s.priority || 0
        },
        update: {
          posCode: s.posCode,
          storeName: s.storeName,
          storeType: s.storeType || 'Retail',
          category: s.category || 'Retail',
          locationType: s.locationType || 'iPlanet Retail Store',
          brand: s.brand || 'iPlanet',
          address: s.address,
          area: s.area,
          locality: s.locality,
          city: s.city,
          state: s.state,
          country: s.country || 'India',
          pincode: s.pincode,
          landmark: s.landmark,
          latitude: s.latitude,
          longitude: s.longitude,
          phone: s.phone,
          contactPerson: s.contactPerson,
          storeManager: s.storeManager,
          openingTime: s.openingTime,
          closingTime: s.closingTime,
          workingDays: s.workingDays,
          googlePlaceId: s.googlePlaceId,
          googleMapsUrl: s.googleMapsUrl,
          status: s.status || 'Active',
          priority: s.priority || 0
        }
      })
    )
  );
  invalidateStoreCache();
}

export async function updateStore(id: string, updates: Partial<Store>): Promise<Store | null> {
  try {
    const existing = await prisma.store.findFirst({ where: { OR: [{ id }, { posCode: id }] } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (updates.status !== undefined) data.status = updates.status;

    const updated = await prisma.store.update({ where: { id: existing.id }, data });
    invalidateStoreCache();
    return mapToStore(updated);
  } catch (err) {
    console.error('Error updating store:', err);
    return null;
  }
}

export async function deleteStore(id: string): Promise<boolean> {
  try {
    const result = await prisma.store.deleteMany({ where: { OR: [{ id }, { posCode: id }] } });
    invalidateStoreCache();
    return result.count > 0;
  } catch (err) {
    console.error('Error deleting store:', err);
    return false;
  }
}

// Search reads the whole store list on every query, so keep it in memory briefly.
// Writes in this instance clear it immediately; other server instances pick up
// changes within STORE_CACHE_TTL_MS. Admin screens read uncached.
const STORE_CACHE_TTL_MS = 60 * 1000;
const storeCache = new Map<StoreCategory, { at: number; stores: Promise<Store[]> }>();

function invalidateStoreCache() {
  storeCache.clear();
}

export async function getAllStores(category: StoreCategory = 'Retail'): Promise<Store[]> {
  const hit = storeCache.get(category);
  if (hit && Date.now() - hit.at < STORE_CACHE_TTL_MS) return hit.stores;

  const stores = category === 'Care' ? getCareCentres() : getRetailStores();
  storeCache.set(category, { at: Date.now(), stores });
  // Don't keep a failed read around.
  stores.catch(() => storeCache.delete(category));
  return stores;
}
