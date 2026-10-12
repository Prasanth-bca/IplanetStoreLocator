# iPlanet AI Store Locator - Project Memory & Architecture Log

## 1. Overview & Current State
The **iPlanet AI Store Locator** is a Next.js (App Router) intelligent search and ranking application for official **iPlanet Retail Stores** (Apple Authorised Resellers) and **iPlanet Care Centres** (Apple Authorised Service Providers).

- **Current Active Store Count**: **84 official stores**
  - **81 Retail Stores**
  - **3 Care Centres** (`CARE-MGP`, `CARE-CBE`, `CARE-BLR`)
- **Geographic Coverage**:
  - **8 States**: Tamil Nadu, Karnataka, Kerala, Maharashtra, Andhra Pradesh, Telangana, Gujarat, Puducherry
  - **38 Operational Cities**: Bengaluru (16 stores), Chennai (6 stores), Coimbatore (5 stores), Mumbai (9 stores), Thane (3 stores), Hyderabad, Visakhapatnam (Vizag), Guntur, Tirupati, Vadodara, Salem, Madurai, Trichy, Vellore, Thanjavur, Nagercoil, Tirunelveli, Thoothukudi, Tiruppur, Dharmapuri, Kannur, Kochi, Kottayam, Palakkad, Trivandrum, Mangalore, Manipal, Satara, Sangli, Dombivli, Ongole, Nalgonda, Miryalaguda, Mancherial, Nizamabad, Kakinada, Anantapur, Eluru.

---

## 2. Database Architecture (SQLite)
The application is backed by a local **SQLite database** using `better-sqlite3`:
- **Database File**: [`data/iplanet.sqlite`](file:///d:/iPlanet%20AI%20Store%20Locator/data/iplanet.sqlite)
- **Configuration & Connection Layer**: [`lib/db.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/db.ts)
  - Write-Ahead Logging (`WAL`) mode enabled with `NORMAL` synchronous mode for low-latency queries.
  - Table: `stores` with columns for POS code, store name, category, brand, address, area, locality, city, state, country, pincode, landmark, GPS latitude/longitude, phone, store manager, timings, working days, status, priority, and timestamps.
  - Indexes: `idx_stores_category`, `idx_stores_status`, `idx_stores_pos_code`, `idx_stores_city`, `idx_stores_pincode`.
- **Repository Abstraction**: [`lib/storeRepo.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/storeRepo.ts)
  - `getRetailStores()`: Queries active retail stores from SQLite ordered by priority and store name.
  - `getCareCentres()`: Queries active service centres from SQLite.
  - `getAllStores(category)`: Unified accessor.
  - `saveRetailStores(stores)` & `saveCareCentres(centres)`: SQLite transactional batch upserts (`INSERT OR REPLACE`) with JSON backups kept in sync.
- **Seeding Script**: [`scripts/seed_sqlite.js`](file:///d:/iPlanet%20AI%20Store%20Locator/scripts/seed_sqlite.js) seeds or re-seeds all 84 stores from master datasets.

---

## 3. Master Sheet & Excel Extraction
- **Master Sheet Location**: [`Master Sheet.xlsx`](file:///d:/iPlanet%20AI%20Store%20Locator/Master%20Sheet.xlsx)
- **Extraction & Normalization Engine**: [`scripts/extract_stores.js`](file:///d:/iPlanet%20AI%20Store%20Locator/scripts/extract_stores.js)
  - Reads `Master Sheet.xlsx` (syncing with newer saves from `Documents/AI Work/Master Sheet.xlsx` if present).
  - Parses degrees/cardinal coordinates (e.g., `12.9719° N / 77.6412° E` or `12.9719, 77.6412`).
  - Normalizes region labels (e.g. `AP / TG` into Andhra Pradesh or Telangana, `Maharastra` into Maharashtra, `Karanataka` into Karnataka).
  - Populates [`data/stores.json`](file:///d:/iPlanet%20AI%20Store%20Locator/data/stores.json).

---

## 4. Search & Ranking Engine (7 Priorities)
Located in [`lib/storeSearchEngine.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/storeSearchEngine.ts):
1. **Priority 1**: Exact POS Code match (e.g. `PBZ1`, `IND 1`, `RMM` / `RMM 1`, `CBE1`). Flexible matching handles both root codes and numeric suffixes.
2. **Priority 2**: Exact 6-digit Indian PIN match (e.g. `600016`, `560038`, `400076`).
3. **Priority 3**: Locality & Area match (e.g. `Whitefield`, `HSR Layout`, `Mogappair`, `Prabhadevi`).
4. **Priority 4**: Landmark proximity (e.g. `Phoenix Mall`, `Ashoka Pillar`, `Viviana Mall`).
5. **Priority 5**: City / Regional cluster match.
6. **Priority 6**: Haversine straight-line distance (zero-cost, no external API keys required).
7. **Priority 7**: Google Routes API live travel time & traffic calculation (when API key is provided).

### Local Geocoding & Index
Located in [`lib/locationResolver.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/locationResolver.ts):
- Preloaded `KNOWN_GEO_INDEX` and `PIN_INDEX` cover landmarks and 6-digit PIN codes across all 8 states without requiring external geocoding calls.

---

## 5. Admin Portal & Import Templates
Located in [`app/admin/page.tsx`](file:///d:/iPlanet%20AI%20Store%20Locator/app/admin/page.tsx) and [`app/api/admin/import/route.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/app/api/admin/import/route.ts):
- **Filters**:
  - Search filter (POS code, store name, city, state, area, PIN)
  - Status filter (`All Statuses`, `Active`, `Temporarily Closed`, `Coming Soon`, `Inactive`)
  - **State Filter**: Dropdown with all 8 operational states
  - **City Filter**: Dropdown dynamically updating based on the selected state (38 cities)
  - One-click **Reset Filters** button
- **Store Table Columns**:
  - `POS Code`
  - `Store Name`
  - **`State / City`** (displays bold City name and State tag)
  - **`Area / Locality`**
  - `PIN Code`
  - `Status` (inline status editor)
  - `Coordinates`
  - `Actions`
- **Import Templates**:
  - Excel template: [`iPlanet_Store_Import_Template.xlsx`](file:///d:/iPlanet%20AI%20Store%20Locator/iPlanet_Store_Import_Template.xlsx) (includes sample data and `Column Guide` sheet)
  - CSV template: [`iPlanet_Store_Import_Template.csv`](file:///d:/iPlanet%20AI%20Store%20Locator/iPlanet_Store_Import_Template.csv)
  - Direct download buttons added to Admin Dashboard header.
  - Template Columns: `Store Name`, `POS Code`, `Store Type`, `State / City`, `Area / Locality`, `PIN Code`, `Landmark`, `Full Address`, `Google Maps / location`, `Latitude & Longitude`.

---

## 6. Testing & Acceptance Scripts
- `node scripts/test_acceptance.js`: Runs full acceptance test suite across PIN codes, POS codes, natural language queries, and Care centre detection.
- `node scripts/seed_sqlite.js`: Re-seeds SQLite database from JSON masters.
- `node scripts/generate_template.js`: Generates latest Excel and CSV import templates.
- `iPlanet-App.bat`: Windows one-click batch launcher for dev server.
