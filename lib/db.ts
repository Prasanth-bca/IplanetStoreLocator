import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Store, StoreCategory, LocationType } from '@/types/store';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'iplanet.sqlite');
const STORES_JSON = path.join(DB_DIR, 'stores.json');
const CARE_JSON = path.join(DB_DIR, 'care_centres.json');

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Create table if not exists matching Store interface and Prisma schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      pos_code TEXT NOT NULL UNIQUE,
      store_name TEXT NOT NULL,
      store_type TEXT NOT NULL DEFAULT 'Retail',
      category TEXT NOT NULL DEFAULT 'Retail',
      brand TEXT NOT NULL DEFAULT 'iPlanet',
      address TEXT NOT NULL,
      area TEXT,
      locality TEXT,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'India',
      pincode TEXT NOT NULL,
      landmark TEXT,
      latitude REAL,
      longitude REAL,
      phone TEXT,
      contact_person TEXT,
      store_manager TEXT,
      opening_time TEXT DEFAULT '10:00 AM',
      closing_time TEXT DEFAULT '09:30 PM',
      working_days TEXT DEFAULT 'Monday to Sunday',
      google_place_id TEXT,
      google_maps_url TEXT,
      status TEXT NOT NULL DEFAULT 'Active',
      priority INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      location_type TEXT NOT NULL DEFAULT 'iPlanet Retail Store'
    );

    CREATE INDEX IF NOT EXISTS idx_stores_category ON stores(category);
    CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
    CREATE INDEX IF NOT EXISTS idx_stores_pos_code ON stores(pos_code);
    CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city);
    CREATE INDEX IF NOT EXISTS idx_stores_pincode ON stores(pincode);
    CREATE INDEX IF NOT EXISTS idx_stores_location_type ON stores(location_type);
  `);

  // Auto-seed if stores table is empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM stores');
  const result = countStmt.get() as { count: number };
  if (result.count === 0) {
    seedDatabaseFromJSON(db);
  }

  dbInstance = db;
  return dbInstance;
}

export function seedDatabaseFromJSON(db: Database.Database): void {
  console.log('Seeding SQLite database with store master data...');

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

  const insertMany = db.transaction((stores: Store[], category: StoreCategory) => {
    for (const s of stores) {
      insertStmt.run({
        id: s.id,
        posCode: s.posCode,
        storeName: s.storeName,
        storeType: s.storeType || (category === 'Care' ? 'Care' : 'Retail'),
        category: s.category || category,
        locationType: (s.locationType || (category === 'Care' ? 'iPlanet Care / Service Centre' : 'iPlanet Retail Store')) as LocationType,
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

  if (fs.existsSync(STORES_JSON)) {
    const retail = JSON.parse(fs.readFileSync(STORES_JSON, 'utf-8'));
    insertMany(retail, 'Retail');
    console.log(`Seeded ${retail.length} Retail Stores into SQLite.`);
  }

  if (fs.existsSync(CARE_JSON)) {
    const care = JSON.parse(fs.readFileSync(CARE_JSON, 'utf-8'));
    insertMany(care, 'Care');
    console.log(`Seeded ${care.length} Care Centres into SQLite.`);
  }
}

// Convert SQLite snake_case row to TypeScript Store interface
export function mapRowToStore(row: any): Store {
  return {
    id: row.id,
    posCode: row.pos_code,
    storeName: row.store_name,
    storeType: row.store_type,
    category: row.category as StoreCategory,
    locationType: (row.location_type || (row.category === 'Care' ? 'iPlanet Care / Service Centre' : 'iPlanet Retail Store')) as LocationType,
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
    contactPerson: row.contact_person,
    storeManager: row.store_manager,
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    workingDays: row.working_days,
    googlePlaceId: row.google_place_id,
    googleMapsUrl: row.google_maps_url,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
