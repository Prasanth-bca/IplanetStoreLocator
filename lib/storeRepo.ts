import { Store, StoreCategory } from '@/types/store';
import { getDatabase, mapRowToStore } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const STORES_JSON = path.join(process.cwd(), 'data', 'stores.json');
const CARE_JSON = path.join(process.cwd(), 'data', 'care_centres.json');

export function clearStoreCache(): void {
  // In SQLite, queries are always live and instant (WAL mode)
}

export function getRetailStores(): Store[] {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM stores 
      WHERE category = 'Retail'
      ORDER BY priority ASC, store_name ASC
    `).all();
    return rows.map(mapRowToStore);
  } catch (err) {
    console.error('Error fetching retail stores from SQLite:', err);
    // Fallback to JSON if SQLite encounters any issue
    return getFallbackFromJSON('Retail');
  }
}

export function saveRetailStores(stores: Store[]): void {
  try {
    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO stores (
        id, pos_code, store_name, store_type, category, location_type, brand,
        address, area, locality, city, state, country, pincode, landmark,
        latitude, longitude, phone, contact_person, store_manager,
        opening_time, closing_time, working_days,
        google_place_id, google_maps_url, status, priority,
        created_at, updated_at
      ) VALUES (
        @id, @posCode, @storeName, @storeType, @category, @locationType, @brand,
        @address, @area, @locality, @city, @state, @country, @pincode, @landmark,
        @latitude, @longitude, @phone, @contactPerson, @storeManager,
        @openingTime, @closingTime, @workingDays,
        @googlePlaceId, @googleMapsUrl, @status, @priority,
        @createdAt, @updatedAt
      )
    `);

    const updateTx = db.transaction((storesList: Store[]) => {
      for (const s of storesList) {
        insertStmt.run({
          id: s.id,
          posCode: s.posCode,
          storeName: s.storeName,
          storeType: s.storeType || 'Retail',
          category: s.category || 'Retail',
          locationType: s.locationType || 'iPlanet Retail Store',
          brand: s.brand || 'iPlanet',
          address: s.address,
          area: s.area || null,
          locality: s.locality || null,
          city: s.city,
          state: s.state,
          country: s.country || 'India',
          pincode: s.pincode,
          landmark: s.landmark || null,
          latitude: s.latitude !== undefined ? s.latitude : null,
          longitude: s.longitude !== undefined ? s.longitude : null,
          phone: s.phone || null,
          contactPerson: s.contactPerson || null,
          storeManager: s.storeManager || null,
          openingTime: s.openingTime || null,
          closingTime: s.closingTime || null,
          workingDays: s.workingDays || null,
          googlePlaceId: s.googlePlaceId || null,
          googleMapsUrl: s.googleMapsUrl || null,
          status: s.status || 'Active',
          priority: s.priority || 0,
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString()
        });
      }
    });

    updateTx(stores);

    // Also keep JSON backup in sync
    try {
      fs.writeFileSync(STORES_JSON, JSON.stringify(stores, null, 2), 'utf-8');
    } catch (_) {}
  } catch (err) {
    console.error('Error saving retail stores to SQLite:', err);
  }
}

export function getCareCentres(): Store[] {
  try {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM stores 
      WHERE category = 'Care'
      ORDER BY priority ASC, store_name ASC
    `).all();
    return rows.map(mapRowToStore);
  } catch (err) {
    console.error('Error fetching care centres from SQLite:', err);
    return getFallbackFromJSON('Care');
  }
}

export function saveCareCentres(centres: Store[]): void {
  try {
    const db = getDatabase();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO stores (
        id, pos_code, store_name, store_type, category, location_type, brand,
        address, area, locality, city, state, country, pincode, landmark,
        latitude, longitude, phone, contact_person, store_manager,
        opening_time, closing_time, working_days,
        google_place_id, google_maps_url, status, priority,
        created_at, updated_at
      ) VALUES (
        @id, @posCode, @storeName, @storeType, @category, @locationType, @brand,
        @address, @area, @locality, @city, @state, @country, @pincode, @landmark,
        @latitude, @longitude, @phone, @contactPerson, @storeManager,
        @openingTime, @closingTime, @workingDays,
        @googlePlaceId, @googleMapsUrl, @status, @priority,
        @createdAt, @updatedAt
      )
    `);

    const updateTx = db.transaction((centresList: Store[]) => {
      for (const s of centresList) {
        insertStmt.run({
          id: s.id,
          posCode: s.posCode,
          storeName: s.storeName,
          storeType: s.storeType || 'Care',
          category: s.category || 'Care',
          locationType: s.locationType || 'iPlanet Care / Service Centre',
          brand: s.brand || 'iPlanet',
          address: s.address,
          area: s.area || null,
          locality: s.locality || null,
          city: s.city,
          state: s.state,
          country: s.country || 'India',
          pincode: s.pincode,
          landmark: s.landmark || null,
          latitude: s.latitude !== undefined ? s.latitude : null,
          longitude: s.longitude !== undefined ? s.longitude : null,
          phone: s.phone || null,
          contactPerson: s.contactPerson || null,
          storeManager: s.storeManager || null,
          openingTime: s.openingTime || null,
          closingTime: s.closingTime || null,
          workingDays: s.workingDays || null,
          googlePlaceId: s.googlePlaceId || null,
          googleMapsUrl: s.googleMapsUrl || null,
          status: s.status || 'Active',
          priority: s.priority || 0,
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString()
        });
      }
    });

    updateTx(centres);

    // Also keep JSON backup in sync
    try {
      fs.writeFileSync(CARE_JSON, JSON.stringify(centres, null, 2), 'utf-8');
    } catch (_) {}
  } catch (err) {
    console.error('Error saving care centres to SQLite:', err);
  }
}

export function updateStore(id: string, updates: Partial<Store>): Store | null {
  try {
    const db = getDatabase();
    const existing = db.prepare('SELECT * FROM stores WHERE id = ? OR pos_code = ?').get(id, id);
    if (!existing) return null;

    const current = mapRowToStore(existing);
    const updated: Store = {
      ...current,
      ...updates,
      id: current.id,
      updatedAt: new Date().toISOString()
    };

    if (updates.status !== undefined) {
      db.prepare('UPDATE stores SET status = ?, updated_at = ? WHERE id = ?').run(
        updated.status,
        updated.updatedAt,
        updated.id
      );
    }

    return updated;
  } catch (err) {
    console.error('Error updating store:', err);
    return null;
  }
}

export function deleteStore(id: string): boolean {
  try {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM stores WHERE id = ? OR pos_code = ?').run(id, id);
    return result.changes > 0;
  } catch (err) {
    console.error('Error deleting store:', err);
    return false;
  }
}

export function getAllStores(category: StoreCategory = 'Retail'): Store[] {
  return category === 'Care' ? getCareCentres() : getRetailStores();
}

function getFallbackFromJSON(category: StoreCategory): Store[] {
  const filePath = category === 'Care' ? CARE_JSON : STORES_JSON;
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (_) {}
  return [];
}
