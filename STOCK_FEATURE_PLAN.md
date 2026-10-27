# Plan: Store Stock View and Stock Update Screen

Status: **Steps 1-5 implemented** (role-based access, step 6, is not). Defaults used for the open decisions: SKU-level stock, status badges only for customers, admin-only updates, sample product catalogue (`npm run db:seed-products`; replace with the real SKU list).

## What exists today
- `Store` model in Prisma on Neon Postgres, keyed by `posCode`.
- `StoreCard.tsx` shows each search result.
- `/admin` has store CRUD and bulk XLSX import (`xlsx` is already a dependency).
- Auth is one shared password for the whole site, enforced in `middleware.ts`. No per-user or per-store roles.

## 1. Data model (Prisma)
Add two tables and run `db:push`:
- **`Product`**: `id`, `sku` (unique), `name`, `category` (iPhone, iPad, Mac, Watch, AirPods, Accessories), `variant` (colour or storage), `active`.
- **`StoreStock`**: `storeId`, `productId`, `quantity`, `lowStockThreshold`, `updatedAt`, `updatedBy`. Unique on `(storeId, productId)`.
- **`StockMovement`** (audit log): `storeId`, `productId`, `delta`, `newQty`, `reason` (Received, Sold, Transfer, Correction), `note`, `createdAt`, `user`.

Status is computed, not stored: `qty = 0` is Out of stock, `qty <= threshold` is Low, anything higher is In stock.

## 2. API routes (`app/api/...`)
- `GET /api/stores/[posCode]/stock`: stock for one store, optional `?category=` filter and search.
- `POST /api/stores/stock/availability`: takes a SKU and the POS codes from the search results, returns which nearby stores have it.
- `PATCH /api/admin/stock/[posCode]`: set or adjust a quantity; writes the `StockMovement` row in the same transaction.
- `POST /api/admin/stock/import`: bulk XLSX/CSV update, reusing the existing import validation pattern.
- `GET /api/admin/products`, `POST /api/admin/products`: manage the catalogue.

## 3. Customer screen: viewing stock
- "View stock" button on each result in `StoreCard.tsx`, opening a slide-over or modal with products grouped by category.
- Each row shows an In stock / Low stock / Out of stock badge and "Updated 2 hrs ago".
- Product search box, plus an optional "Only show stores with this item" filter on the main search (second phase).

## 4. Update screen: new `/admin/stock`
- Pick a store, then an editable table of its products with current quantity.
- Inline +/- and a direct number input; "Save changes" batches the edits.
- Reason dropdown, and a history tab reading from `StockMovement`.
- Bulk upload with a downloadable template.
- Low-stock filter and a "last updated" column.

## 5. Access control
- Keep the existing shared login as the site gate.
- Add a stock-manager PIN per store, or a second role. Store staff edit only their own store; admins edit all.
- Extend `adminAuth.ts` so the session token carries a role and a `posCode`.

## 6. Build order
1. Schema, product seed and the stock read API.
2. "View stock" panel on the store card.
3. `/admin/stock` update screen and `PATCH` with audit log.
4. Bulk import.
5. Product-based "find nearby stores with this item" search.
6. Role-based access.

## Open decisions
1. **Granularity:** SKU-level quantities, or category-level availability? Recommended: SKU-level.
2. **Customer visibility:** exact numbers, or only In stock / Low / Out? Recommended: badges only.
3. **Who updates:** store staff (per-store logins), admins only, or a read-only sync from an ERP or Tally?
4. **Product catalogue:** is there a master product or SKU list that can be imported from Excel?
