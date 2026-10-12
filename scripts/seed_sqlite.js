const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'iplanet.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

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

const retailPath = path.join(__dirname, '..', 'data', 'stores.json');
const carePath = path.join(__dirname, '..', 'data', 'care_centres.json');

const retail = JSON.parse(fs.readFileSync(retailPath, 'utf8'));
const care = JSON.parse(fs.readFileSync(carePath, 'utf8'));

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

const insertAll = db.transaction(() => {
  for (const s of retail) {
    insertStmt.run({
      id: s.id,
      posCode: s.posCode,
      storeName: s.storeName,
      storeType: s.storeType || 'Retail',
      category: 'Retail',
      locationType: 'iPlanet Retail Store',
      brand: s.brand || 'iPlanet',
      address: s.address,
      area: s.area || null,
      locality: s.locality || null,
      city: s.city,
      state: s.state,
      country: s.country || 'India',
      pincode: s.pincode,
      landmark: s.landmark || null,
      latitude: s.latitude || null,
      longitude: s.longitude || null,
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

  for (const s of care) {
    insertStmt.run({
      id: s.id,
      posCode: s.posCode,
      storeName: s.storeName,
      storeType: s.storeType || 'Care',
      category: 'Care',
      locationType: 'iPlanet Care / Service Centre',
      brand: s.brand || 'iPlanet',
      address: s.address,
      area: s.area || null,
      locality: s.locality || null,
      city: s.city,
      state: s.state,
      country: s.country || 'India',
      pincode: s.pincode,
      landmark: s.landmark || null,
      latitude: s.latitude || null,
      longitude: s.longitude || null,
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

insertAll();

const total = db.prepare('SELECT COUNT(*) as count FROM stores').get();
const retailCount = db.prepare("SELECT COUNT(*) as count FROM stores WHERE category = 'Retail'").get();
const careCount = db.prepare("SELECT COUNT(*) as count FROM stores WHERE category = 'Care'").get();

console.log('----------------------------------------------------');
console.log('SQLite DATABASE INITIALIZED SUCCESSFULLY:');
console.log('Database File:', dbPath);
console.log('Total Stores:', total.count);
console.log('Retail Stores:', retailCount.count);
console.log('Care Centres:', careCount.count);
console.log('----------------------------------------------------');
