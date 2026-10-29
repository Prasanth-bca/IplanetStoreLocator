# iPlanet AI Store Locator - Project Memory & Architecture Log

> **Last Updated**: October 30, 2026  
> **Status**: Production-ready, full-stack Next.js web application with PostgreSQL (Prisma ORM), Ola Maps integration, Product & Stock Management, CEC Lead Capture, and Role-Based Access Control (RBAC).

---

## 1. Overview & Operational Scope

The **iPlanet AI Store Locator** is an intelligent store discovery, stock tracking, and lead-routing platform built for official **iPlanet Retail Stores** (Apple Authorised Resellers) and **iPlanet Care Centres** (Apple Authorised Service Providers).

- **Total Active Stores**: **84 official stores**
  - **81 Retail Stores**
  - **3 Care Centres** (`CARE-MGP`, `CARE-CBE`, `CARE-BLR`)
- **Geographic Coverage**:
  - **8 States**: Tamil Nadu, Karnataka, Kerala, Maharashtra, Andhra Pradesh, Telangana, Gujarat, Puducherry.
  - **38 Operational Cities**: Bengaluru (16 stores), Chennai (6 stores), Coimbatore (5 stores), Mumbai (9 stores), Thane (3 stores), Hyderabad, Visakhapatnam (Vizag), Guntur, Tirupati, Vadodara, Salem, Madurai, Trichy, Vellore, Thanjavur, Nagercoil, Tirunelveli, Thoothukudi, Tiruppur, Dharmapuri, Kannur, Kochi, Kottayam, Palakkad, Trivandrum, Mangalore, Manipal, Satara, Sangli, Dombivli, Ongole, Nalgonda, Miryalaguda, Mancherial, Nizamabad, Kakinada, Anantapur, Eluru.
- **Strict Business Rule**: Source of truth is solely verified iPlanet locations. Generic Apple resellers, multi-brand electronics stores, and non-iPlanet shops are strictly excluded.

---

## 2. Database & Data Architecture (PostgreSQL & Prisma ORM)

The application utilizes **Prisma ORM** connecting to **PostgreSQL** (hosted via Neon serverless with pooled and unpooled connections).

- **Prisma Schema**: [`prisma/schema.prisma`](file:///d:/iPlanet%20AI%20Store%20Locator/prisma/schema.prisma)
- **Client Singleton**: [`lib/prisma.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/prisma.ts)
- **Data Repository**: [`lib/storeRepo.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/storeRepo.ts)

### Core Relational Models:
1. **`Store` (`stores`)**:
   - Master entity for all 84 Retail and Care locations.
   - Primary key: `id` (e.g., `store_1`, `care_mgp`). Unique key: `posCode` (e.g., `PBZ1`, `IND 1`, `RMM`, `CBE1`).
   - Fields: POS code, name, category (`Retail` / `Care`), location type, address, area, locality, city, state, country, pincode, landmark, latitude/longitude, phone, store manager, timings, working days, status (`Active`, `Temporarily Closed`, `Coming Soon`, `Inactive`), and priority.
   - Indexes: `[category]`, `[status]`, `[city]`, `[pincode]`, `[locationType]`.
2. **`Product` (`products`)**:
   - Master catalogue of Apple hardware and accessories.
   - Fields: `id`, `sku` (unique), `name`, `category` (`iPhone`, `iPad`, `Mac`, `Watch`, `AirPods`, `Accessories`), `variant`, `active`.
3. **`StoreStock` (`store_stock`)**:
   - Real-time stock levels per store and SKU.
   - Unique constraint: `[storeId, productId]`.
   - Fields: `quantity`, `lowStockThreshold` (default: 2), `updatedAt`, `updatedBy`.
4. **`StockMovement` (`stock_movements`)**:
   - Immutable audit trail of every stock adjustment.
   - Fields: `storeId`, `productId`, `delta`, `newQty`, `reason` (`Received`, `Sold`, `Transfer`, `Correction`), `note`, `createdAt`, `user`.
5. **`Lead` (`leads`)**:
   - Captured customer enquiries passed from locator to stores via WhatsApp.
   - Fields: `clientId` (browser-generated UUID to prevent double submissions), `customerName`, `customerMobile` (10 digits), `storeName`, `posCode`, `product`, `remarks`, `channel` (`web` vs `desktop`), `userId` (attributing sales rep), `userName`, `createdAt`.
6. **`User` (`users`)**:
   - Authentication identity and role assignment.
   - Fields: `username`, `name`, `role` (`ADMIN` or `SALES`), `passwordHash`, `active`, `tokenVersion` (incremented to instantly invalidate sessions across devices), `lastLoginAt`.

---

## 3. Mapping, Geocoding & Routing Cascade

The application implements a multi-provider fallback strategy to achieve high accuracy while keeping API costs near zero:

```text
User Search Query
    ↓
[ Geocoding / Location Resolution ]
 1. Local Pre-Compiled Index (lib/locationResolver.ts)      -> Zero Latency, Free
 2. India Postal API (for 6-digit PIN codes)                -> Free
 3. Ola Maps Geocoding API (lib/olaMaps.ts)                -> 100k requests/mo Free
 4. Google Maps Geocoding API                              -> Pay-per-use Fallback
 5. OpenStreetMap Nominatim                                -> Community Free
    ↓
[ Proximity & Distance Calculation ]
 1. Ola Maps Distance Matrix API (lib/olaMaps.ts)          -> 100k requests/mo Free
 2. Google Distance Matrix / Routes API                    -> Fallback
 3. Internal Haversine Engine (lib/routing.ts)             -> Zero Latency, Free
```

- **Ola Maps Module**: [`lib/olaMaps.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/olaMaps.ts) provides distance matrices and reverse geocoding with timeout safety.
- **In-Memory Cache**: `KNOWN_GEO_INDEX` and `PIN_INDEX` pre-index major landmarks and PIN codes across all 8 operating states without external network overhead.

---

## 4. Intelligent Search & Ranking Engine (7 Priorities)

Located in [`lib/storeSearchEngine.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/storeSearchEngine.ts):

1. **Priority 1 (Exact POS Code)**: Direct match on store POS code (e.g. `PBZ1`, `IND 1`, `RMM`, `CBE1`–`CBE7`).
2. **Priority 2 (PIN Code)**: Exact match on 6-digit postal PIN code.
3. **Priority 3 (Locality / Area)**: Matches neighborhood names (e.g. `Whitefield`, `HSR Layout`, `Mogappair`).
4. **Priority 4 (Landmark Proximity)**: Matches prominent landmarks (e.g. `Phoenix Mall`, `Ashoka Pillar`, `Viviana Mall`).
5. **Priority 5 (City Cluster)**: Groups and prioritizes stores within the matching city.
6. **Priority 6 (Haversine Straight-Line Distance)**: Instant geodesic calculation.
7. **Priority 7 (Live Route & Travel Time)**: Ola Maps / Google Routes traffic-aware driving duration.

---

## 5. Security & Role-Based Access Control (RBAC)

Enforced at the Edge in [`middleware.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/middleware.ts) and [`lib/access.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/access.ts):

- **Roles**:
  - **`ADMIN`**: Unrestricted access to store CRUD, stock updates, product catalogue, user administration, and global lead reports.
  - **`SALES`**: Access limited to Store Locator, stock viewer, product viewer, submitting leads, viewing personal lead history (`/my-leads`), and updating personal passwords.
- **Session Security**:
  - Signed, HTTP-only session cookies (`lib/adminAuth.ts`).
  - `tokenVersion` checks ensure immediate session invalidation when roles or passwords are changed.
- **Rate Limiting**:
  - [`lib/loginThrottle.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/lib/loginThrottle.ts) defends against brute-force attacks on `/api/login`.

---

## 6. Stock Management & "Pass to Store" Workflow

### Stock Management:
- **Customer & Sales View**: Inline stock drawer on [`StoreCard.tsx`](file:///d:/iPlanet%20AI%20Store%20Locator/components/StoreCard.tsx) and `/stock` showing real-time SKU availability with In Stock / Low Stock / Out of Stock badges and timestamps.
- **Admin Stock Desk** (`/admin/stock`):
  - Store picker with instant filtering.
  - Inline quantity adjustment, +/- steppers, and reason tagging (`Received`, `Sold`, `Transfer`, `Correction`).
  - Batch update transaction with full audit trail in `StockMovement`.
  - Bulk stock importer via Excel / CSV (`/api/admin/stock/import`).
- **Product Catalogue Desk** (`/admin/products`): Add, edit, and toggle active status of Apple SKUs.

### "Pass to Store" Customer Enquiry:
- Accessible via the **"Pass to Store"** action on every store card.
- Modal captures customer name, mobile number, product inquiry, and notes.
- Generates deep-links for either **WhatsApp Web** or the **WhatsApp native desktop application** (`whatsapp://send`), pre-populating store executive handoff messages with store POS snapshotting.
- Sales reps can review their historical handoffs at `/my-leads`; Admins review full company logs at `/admin/leads`.

---

## 7. Admin Portal & Import Systems

- **Store Dashboard** ([`app/admin/page.tsx`](file:///d:/iPlanet%20AI%20Store%20Locator/app/admin/page.tsx)):
  - Filter by search text, status, state dropdown, and dynamic city dropdown.
  - Inline store editing and activation toggle.
- **Bulk Import Engine**:
  - Supports `.xlsx` and `.csv` uploads with duplicate POS code detection and coordinate normalization.
  - Pre-packaged templates: [`iPlanet_Store_Import_Template.xlsx`](file:///d:/iPlanet%20AI%20Store%20Locator/iPlanet_Store_Import_Template.xlsx) and [`iPlanet_Store_Import_Template.csv`](file:///d:/iPlanet%20AI%20Store%20Locator/iPlanet_Store_Import_Template.csv).

---

## 8. CLI Scripts & Operations

- `npm run dev`: Launches local Next.js development server on `http://localhost:3000`.
- `npm run db:seed`: Seeds 84 stores into PostgreSQL via [`prisma/seed.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/prisma/seed.ts) using [`data/stores.json`](file:///d:/iPlanet%20AI%20Store%20Locator/data/stores.json) and [`data/care_centres.json`](file:///d:/iPlanet%20AI%20Store%20Locator/data/care_centres.json).
- `npm run db:seed-products`: Seeds initial Apple SKU catalogue via [`prisma/seed-products.ts`](file:///d:/iPlanet%20AI%20Store%20Locator/prisma/seed-products.ts).
- `node scripts/test_acceptance.js`: Automated acceptance suite validating query parsing across PINs, landmarks, POS codes, and Care intent.
- `iPlanet-App.bat`: Interactive Windows CLI menu for server launch, process kill on port 3000, Prisma client generation, and Vercel deployment.

---

## 9. Real ERP Stock Import & 8-Column Hierarchy Architecture

### Current Stock Data Source:
- **Master Export File**: `shared/current stock.xlsx` (Sheet: `Export`, 150,002 rows).
- **8 Core Columns in ERP Export**:
  1. **`Store`**: Retail POS Code (e.g. `ADH1`, `BAL1`, `ANT1`). Maps to `store.posCode` / `storeId`.
  2. **`Product`**: High-level Line of Business / LOB (`IPHONE`, `MAC`, `IPAD`, `WATCH`, `AIRPODS`, `FPP`, `TPP`). Maps to `Product.category`.
  3. **`Segment`**: Product department / accessory category (`iPhone`, `Mac`, `Adapter`, `Case`, `Band`, `Charger`). Maps to `Product.segment`.
  4. **`Class`**: Base model family without specs (`iPhone 15`, `iPhone 17`, `Mac Mini M6`, `Watch SE3 GPS`, `Adapter Mac`). Maps to `Product.class`.
  5. **`SubClass`**: **Full product variation name containing all hardware specs**:
     - *Storage Variations*: `iPhone 15 256GB`, `iPhone 17 512GB`, `iPhone 17 Pro 1TB`, `iPad 11 (11G) CELL 256GB`.
     - *RAM & SSD Variations*: `Mac Mini M6 16GB/256GB`, `Mac Mini M6 24GB/256GB`, `Macbook Air 13 M5 16GB/1TB`.
     - *Size Variations*: `Watch SE3 GPS 40`, `Watch SE3 GPS 44`, `WatchUltra4CELL49`, `BRACELET 40MM`, `BRACELET 46MM`.
     - *Wattage & Spec Variations*: `Adapter-20W`, `Adapter-30W`, `Adapter-70W`, `Adapter-140W`, `Adapter-45W MagSafe`.
     - *Feature Variations*: `AirPods 4G` vs `AirPods 4G ANC`.
     - Maps to `Product.name`.
  6. **`Color`**: Color / Finish (`BLUE`, `NIGHT SKY`, `Black`, `MIDNIGHT`, `SILVER`, `CLEAR`, `BASIC`, `NA`). Maps to `Product.variant`.
  7. **`SerialNumber`**: Unique hardware serial identifier (e.g. `355225773222512`, `SC5JVVLH2XY`, `SDM67NXQ0QY`).
  8. **`Stock`**: Unit count (1 per physical serial row, or aggregated sum for the SKU). Maps to `StoreStock.quantity`.

### Crucial Subtotal Filtering (Zero Data Inflation Guarantee):
- In ERP exports, subtotal rows (`Color = "Total"`, `SubClass = "Total"`, `Class = "Total"`, `Segment = "Total"`, `Product = "Total"`, or empty serial) contain intermediate sums that previously caused counts to double.
- **Rule**: Every physical serialized item has a valid, non-empty `SerialNumber` and counts as exactly 1 unit. All rows with `Total` or missing serials are filtered out.
- **Verified Benchmark**: ADH 1 (iPlanet Andheri West) has exactly **5,244 physical units** across **218 SKUs** (filtered out 388 subtotal rows).

### High-Performance Bulk Import Engine:
1. **Raw SQL Bulk Upsert (`lib/stock.ts` -> `applyBulkStockUpsert`)**:
   - Executes chunked `INSERT INTO "store_stock" ("id", "store_id", "product_id", "quantity", "low_stock_threshold", "updated_by", "updated_at") VALUES ... ON CONFLICT ("store_id", "product_id") DO UPDATE SET "quantity" = EXCLUDED."quantity", "low_stock_threshold" = EXCLUDED."low_stock_threshold", "updated_by" = EXCLUDED."updated_by", "updated_at" = NOW()`.
   - Prevents Postgres `21000` conflict errors via in-memory deduplication prior to batching.
2. **Missing Product Auto-Registration**:
   - Discovered missing SKUs are batch-created via `prisma.product.createMany({ skipDuplicates: true })` in chunks of 100 instead of 1-by-1 queries.
3. **Audit Trail Logging**:
   - All quantity changes are batch-inserted into `stock_movements` with old/new delta calculation.
4. **Dry-Run Simulation**:
   - Supports preview mode (`dryRun: true`) in both the UI and CLI to inspect valid rows, SKUs, and units before writing to the database.
5. **General CLI Importer (`scripts/import_erp_stock.js`)**:
   - Command flags: `--store <POS>`, `--stores <POS1,POS2>`, `--all`, `--dry-run`, `--clean`, `--batch <size>`.

### Planned 8-Column Stock Page Layout:
Matches the Excel column order directly:
`Store` | `Product` | `Segment` | `Class` | `SubClass` | `Color` | `SerialNumber` | `Stock`

### Database & Network Configuration Notes:
- **Neon Serverless Host**: `ep-wispy-hat-b79l1c19-pooler.c-13.us-east-1.aws.neon.tech:5432`
- **DNS Resolution**: `dns.setDefaultResultOrder('ipv4first')` and public DNS resolvers (`8.8.8.8`, `1.1.1.1`) ensure connection stability when local mobile hotspot or IPv6 DNS routes block cloud endpoints.
