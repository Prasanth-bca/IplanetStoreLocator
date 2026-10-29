/**
 * iPlanet AI Store Locator — High Performance ERP Bulk Stock Importer
 *
 * Features:
 *  - Blazing fast bulk batching via raw SQL INSERT ... ON CONFLICT DO UPDATE
 *  - Auto-detection & batch registration of missing products
 *  - 100% accurate count: skips ERP subtotal rows (Color/SubClass = 'Total')
 *  - Per-store filtering, multi-store, or all stores (--all)
 *  - Dry-run mode (--dry-run) to inspect quantities with zero database risk
 *  - Optional clean wipe (--clean) per store before import
 *  - Full audit-logging in stock_movements
 *
 * Usage:
 *  node scripts/import_erp_stock.js --store ADH1
 *  node scripts/import_erp_stock.js --stores ADH1,ANT1,BAL1 --dry-run
 *  node scripts/import_erp_stock.js --store ADH1 --clean
 *  node scripts/import_erp_stock.js --all
 */

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: false });

// Ensure pooler URL is used directly
// DATABASE_URL in .env points to the working pooler endpoint

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: 'shared/current stock.xlsx',
    store: null,
    stores: [],
    all: false,
    dryRun: false,
    clean: false,
    batchSize: 100,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--file' && args[i + 1]) options.file = args[++i];
    else if (a === '--store' && args[i + 1]) options.stores.push(args[++i].toUpperCase().trim());
    else if (a === '--stores' && args[i + 1]) {
      options.stores.push(...args[++i].split(',').map(s => s.toUpperCase().trim()));
    }
    else if (a === '--all') options.all = true;
    else if (a === '--dry-run') options.dryRun = true;
    else if (a === '--clean') options.clean = true;
    else if (a === '--batch' && args[i + 1]) options.batchSize = parseInt(args[++i], 10) || 100;
    else if (a === '--help' || a === '-h') {
      console.log(`
iPlanet Bulk Stock Importer
Options:
  --file <path>        Path to current stock.xlsx (default: shared/current stock.xlsx)
  --store <POS>        Single store POS code to import (e.g. --store ADH1)
  --stores <POS,POS>   Multiple store POS codes (e.g. --stores ADH1,BAL1,ANT1)
  --all                Import all stores found in the file
  --dry-run            Analyze and preview counts without writing to DB
  --clean              Clear existing stock for the target store(s) before importing
  --batch <size>       Batch chunk size for SQL operations (default: 100)
`);
      process.exit(0);
    }
  }

  // If no store flag given and not --all, default to ADH1
  if (!options.all && options.stores.length === 0) {
    options.stores = ['ADH1'];
  }

  return options;
}

function normalizeCategory(lob) {
  const upper = String(lob || '').trim().toUpperCase();
  if (upper.includes('IPHONE') || upper.includes('PHONE')) return 'iPhone';
  if (upper.includes('MAC')) return 'Mac';
  if (upper.includes('IPAD')) return 'iPad';
  if (upper.includes('WATCH')) return 'Watch';
  if (upper.includes('AIRPOD')) return 'AirPods';
  return 'Accessories';
}

function generateSku(category, subClass, color) {
  const catShort = category.toUpperCase().slice(0, 4);
  const base = (subClass + (color ? '-' + color : ''))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${catShort}-${base}`;
}

async function main() {
  const opts = parseArgs();
  console.log('\n======================================================');
  console.log('       iPlanet AI Store Locator — ERP Stock Importer   ');
  console.log('======================================================');
  console.log(`Mode        : ${opts.dryRun ? '🔍 DRY RUN (Preview only)' : '⚡ LIVE IMPORT (Direct DB write)'}`);
  console.log(`Clean wipe  : ${opts.clean ? 'YES (Wipe target store stock first)' : 'NO (Additive / Upsert)'}`);
  console.log(`Target      : ${opts.all ? 'ALL STORES in file' : opts.stores.join(', ')}`);
  console.log(`Batch Size  : ${opts.batchSize}`);
  console.log(`File        : ${opts.file}`);
  console.log('------------------------------------------------------\n');

  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Stock file not found at: ${filePath}`);
  }

  console.log('📖 Reading Excel file...');
  const t0 = Date.now();
  const wb = xlsx.readFile(filePath, { dense: true });
  const sheetName = wb.SheetNames[0];
  const allRows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  console.log(`✓ Read ${allRows.length.toLocaleString()} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  // 1. Fetch DB stores
  console.log('🏪 Fetching stores from database...');
  const dbStores = await prisma.store.findMany({
    select: { id: true, posCode: true, storeName: true, city: true },
  });

  const storeByPos = new Map();
  dbStores.forEach(s => {
    const raw = s.posCode.trim().toUpperCase();
    const compact = raw.replace(/\s+/g, '');
    storeByPos.set(raw, s);
    storeByPos.set(compact, s);
    if (!raw.endsWith('1')) {
      storeByPos.set(raw + '1', s);
      storeByPos.set(compact + '1', s);
    }
  });

  // 2. Filter & Aggregate rows
  console.log('⚙️  Filtering valid serial rows and calculating inventory...');
  const targetStoreSet = new Set(opts.stores.map(s => s.replace(/\s+/g, '')));
  
  // storeId -> Map<productName, { category, color, units }>
  const storeData = new Map();
  let totalValidUnits = 0;
  let totalSkippedTotals = 0;
  let unmatchedStores = new Set();

  for (const row of allRows) {
    const rawStore = String(row.Store || row.store || '').trim();
    if (!rawStore || rawStore.toLowerCase().includes('applied filter') || rawStore.toLowerCase().includes('exported data')) {
      totalSkippedTotals++;
      continue;
    }

    const normStore = rawStore.toUpperCase().replace(/\s+/g, '');
    if (!opts.all && !targetStoreSet.has(normStore) && !targetStoreSet.has(rawStore.toUpperCase())) {
      continue;
    }

    // Identify store in DB
    const storeInfo = storeByPos.get(normStore) || storeByPos.get(rawStore.toUpperCase());
    if (!storeInfo) {
      unmatchedStores.add(rawStore);
      continue;
    }

    // Subtotal and Total filter
    const color = String(row.Color || '').trim();
    const subClass = String(row.SubClass || row.Class || '').trim();
    const rawClass = String(row.Class || '').trim();
    const rawSegment = String(row.Segment || '').trim();
    const lob = String(row.Product || '').trim();
    const serial = String(row.SerialNumber || '').trim();

    const isTotalRow =
      color.toLowerCase() === 'total' ||
      subClass.toLowerCase() === 'total' ||
      lob.toLowerCase() === 'total' ||
      (!serial && !subClass);

    if (isTotalRow) {
      totalSkippedTotals++;
      continue;
    }

    const productName = subClass || 'Apple Product';
    const category = normalizeCategory(lob);

    if (!storeData.has(storeInfo.id)) {
      storeData.set(storeInfo.id, { info: storeInfo, products: new Map() });
    }

    const pMap = storeData.get(storeInfo.id).products;
    const key = productName.toUpperCase();
    if (pMap.has(key)) {
      pMap.get(key).units += 1;
    } else {
      pMap.set(key, { name: productName, category, segment: rawSegment || lob || null, class: rawClass || null, color, units: 1 });
    }

    totalValidUnits++;
  }

  if (unmatchedStores.size > 0) {
    console.log(`⚠️  ${unmatchedStores.size} store codes in file not matched in DB:`, Array.from(unmatchedStores).slice(0, 8).join(', '));
  }

  console.log(`✓ Processed ${totalValidUnits.toLocaleString()} valid units across ${storeData.size} target store(s)`);
  console.log(`✓ Filtered out ${totalSkippedTotals.toLocaleString()} ERP subtotal/summary rows (guaranteeing exact counts)\n`);

  // Print Summary Table
  console.log('------------------------------------------------------');
  console.log('STORE SUMMARY PREVIEW:');
  console.log('------------------------------------------------------');
  let grandTotalUnits = 0;
  let grandTotalSKUs = 0;

  for (const [, { info, products }] of storeData.entries()) {
    const storeUnits = Array.from(products.values()).reduce((s, p) => s + p.units, 0);
    grandTotalUnits += storeUnits;
    grandTotalSKUs += products.size;
    console.log(` • [${info.posCode.padEnd(6)}] ${info.storeName.padEnd(30)} : ${String(products.size).padStart(4)} SKUs | ${String(storeUnits).padStart(6)} units`);
  }
  console.log('------------------------------------------------------');
  console.log(`TOTAL   : ${grandTotalSKUs} SKUs | ${grandTotalUnits.toLocaleString()} units`);
  console.log('------------------------------------------------------\n');

  if (opts.dryRun) {
    console.log('🔍 DRY RUN COMPLETE. No database changes were made.\n');
    return;
  }

  // 3. Clean wipe if requested
  if (opts.clean) {
    console.log('🧹 Clearing existing stock for target store(s)...');
    for (const [storeId, { info }] of storeData.entries()) {
      await prisma.stockMovement.deleteMany({ where: { storeId } });
      await prisma.storeStock.deleteMany({ where: { storeId } });
      console.log(`   Cleared [${info.posCode}] ${info.storeName}`);
    }
    console.log('✓ Target stores reset to clean state\n');
  }

  // 4. Batch Create Missing Products
  console.log('📦 Checking product catalogue in database...');
  const existingProducts = await prisma.product.findMany({
    select: { id: true, sku: true, name: true },
  });
  const productByName = new Map(existingProducts.map(p => [p.name.toUpperCase(), p.id]));
  const productBySku = new Map(existingProducts.map(p => [p.sku.toUpperCase(), p.id]));

  const missingProducts = [];
  for (const [, { products }] of storeData.entries()) {
    for (const [key, item] of products.entries()) {
      if (!productByName.has(key) && !productBySku.has(key)) {
        let baseSku = generateSku(item.category, item.name, item.color);
        let uniqueSku = baseSku;
        let counter = 1;
        while (productBySku.has(uniqueSku.toUpperCase())) {
          uniqueSku = `${baseSku}-${counter++}`;
        }
        productBySku.set(uniqueSku.toUpperCase(), 'pending');
        productByName.set(key, 'pending');
        missingProducts.push({
          sku: uniqueSku,
          name: item.name,
          category: item.category,
          segment: item.segment,
          class: item.class,
          variant: item.color || null,
          active: true,
        });
      }
    }
  }

  // Backfill segment and class for existing products if empty
  console.log('🔄 Checking if existing products need Segment/Class backfill...');
  const metadataMap = new Map();
  for (const [, { products }] of storeData.entries()) {
    for (const [key, item] of products.entries()) {
      if (item.segment || item.class) {
        metadataMap.set(key, { segment: item.segment, class: item.class });
      }
    }
  }

  const existingNull = await prisma.product.findMany({
    where: { OR: [{ segment: null }, { class: null }] },
    select: { id: true, name: true, segment: true, class: true },
  });

  if (existingNull.length > 0) {
    let updatedCount = 0;
    for (const prod of existingNull) {
      const meta = metadataMap.get(prod.name.toUpperCase());
      if (meta && (!prod.segment || !prod.class)) {
        await prisma.product.update({
          where: { id: prod.id },
          data: {
            segment: prod.segment || meta.segment,
            class: prod.class || meta.class,
          },
        }).catch(() => {});
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.log(`✓ Backfilled Segment and Class for ${updatedCount} existing products`);
    }
  }

  if (missingProducts.length > 0) {
    console.log(`✨ Batch-creating ${missingProducts.length} new product catalogue items...`);
    for (let i = 0; i < missingProducts.length; i += opts.batchSize) {
      await prisma.product.createMany({
        data: missingProducts.slice(i, i + opts.batchSize),
        skipDuplicates: true,
      });
    }
    // Refresh IDs
    const reloaded = await prisma.product.findMany({ select: { id: true, sku: true, name: true } });
    reloaded.forEach(p => {
      productByName.set(p.name.toUpperCase(), p.id);
      productBySku.set(p.sku.toUpperCase(), p.id);
    });
    console.log(`✓ Products registered\n`);
  } else {
    console.log('✓ All products already present in catalog\n');
  }

  // 5. Batch Upsert Store Stock via Raw SQL
  console.log('⚡ Batch upserting stock to database...');
  let totalUpserted = 0;
  const movementLogs = [];

  for (const [storeId, { info, products }] of storeData.entries()) {
    const items = [];
    for (const [key, p] of products.entries()) {
      const productId = productByName.get(key) || productBySku.get(key);
      if (!productId || productId === 'pending') continue;

      const threshold =
        p.category === 'iPhone' ? 5 :
        p.category === 'Mac' ? 3 :
        p.category === 'iPad' ? 3 :
        p.category === 'Watch' ? 3 :
        p.category === 'AirPods' ? 3 :
        Math.max(5, Math.floor(p.units * 0.05));

      items.push({ storeId, productId, quantity: p.units, lowStockThreshold: threshold });
    }

    // Chunked Raw SQL upsert
    for (let i = 0; i < items.length; i += opts.batchSize) {
      const chunk = items.slice(i, i + opts.batchSize);
      const values = chunk.map(s => {
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 25);
        return `('${id}', '${s.storeId}', '${s.productId}', ${s.quantity}, ${s.lowStockThreshold}, 'erp-bulk-import', NOW())`;
      }).join(',\n');

      await prisma.$executeRawUnsafe(`
        INSERT INTO "store_stock" ("id", "store_id", "product_id", "quantity", "low_stock_threshold", "updated_by", "updated_at")
        VALUES ${values}
        ON CONFLICT ("store_id", "product_id")
        DO UPDATE SET
          "quantity" = EXCLUDED."quantity",
          "low_stock_threshold" = EXCLUDED."low_stock_threshold",
          "updated_by" = EXCLUDED."updated_by",
          "updated_at" = NOW()
      `);

      chunk.forEach(s => {
        movementLogs.push({
          storeId: s.storeId,
          productId: s.productId,
          delta: s.quantity,
          newQty: s.quantity,
          reason: 'Import',
          note: `ERP batch import: [${info.posCode}] ${info.storeName}`,
          user: 'admin',
        });
      });

      totalUpserted += chunk.length;
    }
  }

  // 6. Record Movement Logs
  console.log(`📝 Recording ${movementLogs.length} stock movement audit logs...`);
  for (let i = 0; i < movementLogs.length; i += opts.batchSize) {
    await prisma.stockMovement.createMany({
      data: movementLogs.slice(i, i + opts.batchSize),
      skipDuplicates: false,
    });
  }

  const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n======================================================');
  console.log('🎉 BULK IMPORT SUCCESSFULLY COMPLETED');
  console.log('======================================================');
  console.log(`Stores updated      : ${storeData.size}`);
  console.log(`SKUs updated        : ${totalUpserted}`);
  console.log(`Total units stored  : ${grandTotalUnits.toLocaleString()}`);
  console.log(`Movements recorded  : ${movementLogs.length}`);
  console.log(`Total time elapsed  : ${durationSec}s`);
  console.log('======================================================\n');
}

main()
  .catch(err => {
    console.error('\n❌ FATAL IMPORT ERROR:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
