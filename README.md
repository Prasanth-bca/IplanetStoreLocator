# iPlanet AI Store Locator

A modern, production-ready, standalone web application for discovering official **iPlanet Retail Stores** and **iPlanet Care Centres**.

---

## 🌟 Key Highlights & Architecture

1. **Source of Truth**:
   - Internal iPlanet Store Master preloaded with verified active stores across Tamil Nadu, Puducherry, Kerala, and Karnataka.
   - Separate datasets for **Retail Stores** and **iPlanet Care / Service Centres**.
   - Strictly does not substitute random electronics shops or generic Apple resellers.
2. **First-Class POS Code Integration**:
   - Unique POS Codes (`PBZ1`, `MGP1`, `VAL1`, `TAM`, `OMR`, `AVD`, `CBE1`–`CBE7`, `IND 1`, `RMM`, etc.) are prominently rendered on every card and are directly searchable.
3. **Smart Ranking Engine (7 Priorities)**:
   - **Priority 1**: Exact POS Code match
   - **Priority 2**: Exact 6-digit Indian PIN match
   - **Priority 3**: Locality & Area match
   - **Priority 4**: Landmark proximity
   - **Priority 5**: City match
   - **Priority 6**: Haversine straight-line distance
   - **Priority 7**: Route distance and live travel time calculation
   - Automatic highlighting of the **Preferred / Nearest Store**.
4. **Google Maps Platform Integration**:
   - Geocoding API & Places API integration (server-side with `.env`).
   - Distance Matrix / Routes API with smart shortlist filtering to minimize API costs.
   - Instant zero-cost fallback geocoding for Indian PIN codes and key landmarks.
   - Built-in Haversine distance calculator ensures 100% functionality without requiring external API keys.
5. **Modern Responsive UI**:
   - Customer-facing split view with Store Cards and interactive Google Maps preview.
   - Results count selector (1, 3, 5, 10 stores).
   - "Use My Location" browser geolocation button.
   - Clean iPlanet retail design system.
6. **Full Admin Portal**:
   - Store inventory overview with filter by POS code, city, PIN code, and status.
   - Add/edit store metadata and toggle status (*Active*, *Temporarily Closed*, *Coming Soon*, *Inactive*).
   - Bulk import for XLSX and CSV with duplicate POS code checks and validation reports.
7. **Future Extensibility**:
   - Schema and repository designed for check-in-store product availability and service appointments.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ (Node.js LTS v24 installed)
- npm or pnpm

### 2. Configuration & Environment Variables
Create or inspect `.env` in the root directory:

```env
PORT=3000

# PostgreSQL Database (Optional - application runs out-of-the-box with JSON store master)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/iplanet_locator?schema=public

# Google Maps Platform (Server-Side)
# Optional: The app operates with internal Indian PIN/Landmark geocoding and Haversine distance if left empty
GOOGLE_MAPS_API_KEY=
GOOGLE_PLACES_API_KEY=
GOOGLE_ROUTES_API_KEY=

# Public Map Key (Optional)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Admin Secrets
ADMIN_PASSWORD=admin@iplanet2026
ADMIN_SESSION_SECRET=iplanet_super_secret_jwt_key_2026
```

### 3. Running the Application
The application is pre-built and running on **http://localhost:3000**.

To run in development or production mode manually:
```bash
# Start development server
npm run dev

# Or build and launch production server
npm run build
npm run start
```

---

## 🧪 Acceptance Test Verification
Run the automated test suite verifying all required test cases:
```bash
node scripts/test_acceptance.js
```
- `600016`: Returns top 3 nearest stores in Chennai ranked by proximity (`VAL1`, `PBZ1`, `MGP1`) with approx distance.
- `Whitefield`: Accurately resolves to Bengaluru and returns `IND 1 (Indiranagar)` and `RMM (Royal Meenakshi Mall)`.
- `Ashoka Pillar`: Resolves to Jayanagar and recommends `RMM` and `IND 1`.
- `RMM`: Direct Priority 1 POS code match returning `iPlanet Royal Meenakshi Mall`.
- `Coimbatore`: Returns top 3 stores in Coimbatore (`CBE3`, `CBE1`, `CBE7`).
- `iPlanet near Phoenix Mall`: Natural language query parsed, finds nearest store in Bengaluru.
- `3 iPlanet stores near HSR`: Returns requested count of 3 nearest stores.
- `iPlanet Care near Powai`: Detects `Care` category intent, correctly returns no stores (Powai is outside iPlanet territory).

---

## 📁 Project Structure
```text
├── app/
│   ├── page.tsx                  # Customer-facing Store Locator with Map
│   ├── layout.tsx                # Apple / iPlanet typography and styling
│   ├── globals.css               # Global stylesheet and utilities
│   ├── admin/
│   │   └── page.tsx              # Admin Management Portal & Bulk Importer
│   └── api/
│       ├── stores/search/route.ts# Search REST API endpoint
│       └── admin/                # Store CRUD and bulk upload endpoints
├── components/
│   ├── Navbar.tsx                # Header navigation bar
│   ├── SearchHero.tsx            # Main hero search box with chips
│   ├── StoreCard.tsx             # Result card with POS code, timings & distance
│   └── InteractiveMap.tsx        # Interactive map with store pins
├── data/
│   ├── stores.json               # Preloaded iPlanet Retail Store Master
│   └── care_centres.json         # Separate Care Centre dataset
├── lib/
│   ├── storeRepo.ts              # Data access repository
│   ├── searchParser.ts           # Natural language query parser
│   ├── locationResolver.ts       # PIN code and landmark geocoding
│   ├── routing.ts                # Haversine distance and Google Routes
│   └── storeSearchEngine.ts      # Multi-level ranking engine
├── prisma/
│   └── schema.prisma             # Production PostgreSQL Prisma schema
├── scripts/
│   ├── extract_stores.js         # Extraction script from Master Sheet.xlsx
│   └── test_acceptance.js        # Automated acceptance testing script
└── Master Sheet.xlsx             # Source spreadsheet
```
