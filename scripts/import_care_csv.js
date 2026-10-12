/**
 * import_care_csv.js
 * ------------------
 * Parses "Planet Care and Sevise.csv" and:
 *   1. Adds location_type column to the stores table (if not present)
 *   2. Updates all existing Retail records → location_type = 'iPlanet Retail Store'
 *   3. Clears old Care placeholder data
 *   4. Imports all care centres from the CSV → location_type = 'iPlanet Care / Service Centre'
 *   5. Writes updated care_centres.json backup
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const dbPath = path.join(projectRoot, 'data', 'iplanet.sqlite');
const careJsonPath = path.join(projectRoot, 'data', 'care_centres.json');
const csvPath = path.join(projectRoot, 'Planet Care and Sevise.csv');
const storesJsonPath = path.join(projectRoot, 'data', 'stores.json');

// ── 1. Open DB ────────────────────────────────────────────────────────────────
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ── 2. Add location_type column if missing ────────────────────────────────────
const cols = db.prepare('PRAGMA table_info(stores)').all().map(c => c.name);
if (!cols.includes('location_type')) {
  db.exec(`ALTER TABLE stores ADD COLUMN location_type TEXT NOT NULL DEFAULT 'iPlanet Retail Store'`);
  console.log('✅ Added location_type column to stores table.');
} else {
  console.log('ℹ️  location_type column already exists.');
}

// Create index on location_type
db.exec(`CREATE INDEX IF NOT EXISTS idx_stores_location_type ON stores(location_type)`);

// ── 3. Update all existing Retail rows ───────────────────────────────────────
const retailUpdated = db.prepare(`
  UPDATE stores SET location_type = 'iPlanet Retail Store' WHERE category = 'Retail'
`).run();
console.log(`✅ Marked ${retailUpdated.changes} Retail stores as 'iPlanet Retail Store'.`);

// ── 4. Delete stale Care placeholder data ────────────────────────────────────
const careDeleted = db.prepare(`DELETE FROM stores WHERE category = 'Care'`).run();
console.log(`🗑️  Removed ${careDeleted.changes} old Care placeholder records.`);

// ── 5. Parse CSV ──────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  // Parse header
  const header = parseCSVLine(lines[0]);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;
    const obj = {};
    header.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const csvRows = parseCSV(csvPath);
console.log(`📂 Parsed ${csvRows.length} rows from CSV.`);

// ── 6. Derive city/state from address ─────────────────────────────────────────
function extractCityState(region, address) {
  // Region column already has the state
  let state = (region || '').trim();
  let city = '';

  // Normalize state name
  const sl = state.toLowerCase();
  if (sl.includes('tamil') || sl === 'tamilnadu') state = 'Tamil Nadu';
  else if (sl.includes('karnataka') || sl.includes('karanataka')) state = 'Karnataka';
  else if (sl.includes('kerala') || sl.includes('keralam')) state = 'Kerala';
  else if (sl.includes('maharashtra') || sl.includes('maharastra')) state = 'Maharashtra';
  else if (sl.includes('andhra')) state = 'Andhra Pradesh';
  else if (sl.includes('telangana')) state = 'Telangana';
  else if (sl.includes('gujarat')) state = 'Gujarat';
  else if (sl.includes('puducherry') || sl.includes('pondicherry')) state = 'Puducherry';
  else if (sl.includes('goa')) state = 'Goa';
  else if (!state) state = 'Tamil Nadu';

  // Try to extract city from the address (last meaningful segment before pincode)
  // Typical format: "..., City Name, State PinCode"
  const addrParts = address.split(',').map(s => s.trim());
  // Walk backwards and find something that looks like a city (not state/pincode)
  for (let i = addrParts.length - 1; i >= 0; i--) {
    const part = addrParts[i];
    // Remove pincode lines
    const cleaned = part.replace(/\b\d{6}\b/, '').trim();
    if (!cleaned) continue;
    // If it matches the state name, skip
    if (cleaned.toLowerCase() === state.toLowerCase()) continue;
    // If it's just digits, skip
    if (/^\d+$/.test(cleaned)) continue;
    city = cleaned;
    break;
  }

  if (!city) city = state;
  return { city, state };
}

function extractPincode(address) {
  const match = address.match(/\b([1-9][0-9]{5})\b/);
  return match ? match[1] : '';
}

// ── 7. Build insert statement ─────────────────────────────────────────────────
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

const careCentres = [];
let skipped = 0;
const now = new Date().toISOString();

const importAll = db.transaction(() => {
  csvRows.forEach((row, idx) => {
    const posCode = (row['Updated Store Code'] || row['Store Code'] || '').trim();
    const businessName = (row['Business name'] || '').trim();
    const address = (row['Store Address'] || '').trim();
    const region = (row['Region'] || '').trim();
    const mapUrl = (row['Map url'] || '').trim();
    const microsite = (row['Microsite'] || '').trim();
    const phone = (row['Number on GMB'] || '').trim();
    const latRaw = (row['Lattitude'] || row['Latitude'] || '').trim();
    const lngRaw = (row['Longitude'] || '').trim();

    // Skip completely empty rows
    if (!posCode && !address) { skipped++; return; }
    if (!posCode) { skipped++; return; }

    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    const latitude = !isNaN(lat) && lat !== 0 ? lat : null;
    const longitude = !isNaN(lng) && lng !== 0 ? lng : null;

    const pincode = extractPincode(address);
    const { city, state } = extractCityState(region, address);

    // Derive a clean store name
    let storeName = businessName;
    // Normalize variations like "Apple Authorised Service Provider - iPlanet Care", "Apple Service Provider - iPlanetcare"
    if (!storeName || storeName.toLowerCase().includes('apple')) {
      storeName = `iPlanet Care & Service Centre - ${city}`;
    }

    const googleMapsUrl = mapUrl || (latitude && longitude
      ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
      : null);

    const record = {
      id: `care_${idx + 1}`,
      posCode,
      storeName,
      storeType: 'Care',
      category: 'Care',
      locationType: 'iPlanet Care / Service Centre',
      brand: 'iPlanet',
      address: address || `iPlanet Care Centre, ${city} - ${pincode}`,
      area: null,
      locality: null,
      city: city || state,
      state,
      country: 'India',
      pincode: pincode || '000000',
      landmark: null,
      latitude,
      longitude,
      phone: phone || null,
      contactPerson: 'Service Manager',
      storeManager: null,
      openingTime: '10:00 AM',
      closingTime: '08:00 PM',
      workingDays: 'Monday to Saturday',
      googlePlaceId: null,
      googleMapsUrl,
      status: 'Active',
      priority: idx + 1,
      createdAt: now,
      updatedAt: now
    };

    insertStmt.run(record);
    careCentres.push(record);
  });
});

importAll();

console.log(`✅ Imported ${careCentres.length} Care & Service Centres (skipped ${skipped} empty rows).`);

// ── 8. Update stores.json to include location_type for Retail ─────────────────
if (fs.existsSync(storesJsonPath)) {
  const storesData = JSON.parse(fs.readFileSync(storesJsonPath, 'utf-8'));
  const updated = storesData.map(s => ({
    ...s,
    location_type: 'iPlanet Retail Store',
    locationType: 'iPlanet Retail Store'
  }));
  fs.writeFileSync(storesJsonPath, JSON.stringify(updated, null, 2), 'utf-8');
  console.log(`✅ Updated stores.json with location_type for ${updated.length} Retail stores.`);
}

// ── 9. Write care_centres.json ────────────────────────────────────────────────
fs.writeFileSync(careJsonPath, JSON.stringify(careCentres, null, 2), 'utf-8');
console.log(`✅ Saved ${careCentres.length} Care Centres to care_centres.json.`);

// ── 10. Final summary ─────────────────────────────────────────────────────────
const finalRetail = db.prepare("SELECT COUNT(*) as c FROM stores WHERE category='Retail'").get();
const finalCare = db.prepare("SELECT COUNT(*) as c FROM stores WHERE category='Care'").get();
const finalTotal = db.prepare("SELECT COUNT(*) as c FROM stores").get();

console.log('\n════════════════════════════════════════════════');
console.log('DATABASE UPDATE COMPLETE');
console.log('════════════════════════════════════════════════');
console.log(`Total Stores     : ${finalTotal.c}`);
console.log(`Retail Stores    : ${finalRetail.c}  → location_type = 'iPlanet Retail Store'`);
console.log(`Care & Service   : ${finalCare.c}  → location_type = 'iPlanet Care / Service Centre'`);
console.log('════════════════════════════════════════════════');
