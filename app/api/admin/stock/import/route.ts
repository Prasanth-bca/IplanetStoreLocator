import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { prisma } from '@/lib/prisma';
import { applyBulkStockUpsert, BulkStockItem } from '@/lib/stock';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function normalizeLobCategory(lob: string): string {
  const upper = lob.trim().toUpperCase();
  if (upper.includes('IPHONE') || upper.includes('PHONE')) return 'iPhone';
  if (upper.includes('MAC')) return 'Mac';
  if (upper.includes('IPAD')) return 'iPad';
  if (upper.includes('WATCH')) return 'Watch';
  if (upper.includes('AIRPOD')) return 'AirPods';
  return 'Accessories';
}

function generateSkuSlug(category: string, name: string): string {
  const cat = category.toUpperCase().slice(0, 4);
  const clean = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return `${cat}-${clean}`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const isDryRun = formData.get('dryRun') === 'true' || request.nextUrl.searchParams.get('dryRun') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const workbook = xlsx.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json<any>(workbook.Sheets[sheetName], { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Uploaded sheet contains no data' }, { status: 400 });
    }

    // 1. Load existing stores and products
    const [allStores, allProducts] = await Promise.all([
      prisma.store.findMany({ select: { id: true, posCode: true, storeName: true, city: true } }),
      prisma.product.findMany({ select: { id: true, sku: true, name: true, category: true } }),
    ]);

    // Store POS resolution map
    const storeByPos = new Map<string, { id: string; posCode: string; storeName: string; city: string }>();
    allStores.forEach(s => {
      const code = s.posCode.trim().toUpperCase();
      const info = { id: s.id, posCode: s.posCode, storeName: s.storeName, city: s.city };
      storeByPos.set(code, info);
      storeByPos.set(code.replace(/\s+/g, ''), info);
      if (!code.endsWith('1')) {
        storeByPos.set(code + '1', info);
        storeByPos.set(code.replace(/\s+/g, '') + '1', info);
      }
    });

    // Product resolution maps
    const productBySku = new Map<string, string>();
    const productByName = new Map<string, string>();
    allProducts.forEach(p => {
      productBySku.set(p.sku.trim().toUpperCase(), p.id);
      productByName.set(p.name.trim().toUpperCase(), p.id);
    });

    // Detect format
    const sample = rows[0] || {};
    const isErpFormat =
      'Store' in sample ||
      'STORE' in sample ||
      'SubClass' in sample ||
      'SUBCLASS' in sample ||
      'SerialNumber' in sample ||
      'Class' in sample;

    const errors: { row: number; posCode: string; sku: string; error: string }[] = [];
    const missingProductsMap = new Map<string, { sku: string; name: string; category: string; segment: string | null; class: string | null; variant: string | null }>();
    const productsToUpdateMeta = new Map<string, { segment: string | null; class: string | null }>();
    
    // Aggregation: Map<storeId, Map<productNameKey, { count, category }>>
    const storeAggregations = new Map<string, Map<string, { count: number; category: string }>>();
    let validRows = 0;
    let skippedSummaryRows = 0;
    let totalUnits = 0;

    if (isErpFormat) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const rawStore = String(row['Store'] ?? row['STORE'] ?? row['store'] ?? row['POS Code'] ?? '').trim();
        // Skip ERP summary / footer rows
        if (!rawStore || rawStore.toLowerCase().includes('applied filter') || rawStore.toLowerCase().includes('exported data')) {
          skippedSummaryRows++;
          continue;
        }

        // Subtotal checks
        const serial = String(row['SerialNumber'] ?? row['Serial Number'] ?? row['serial_number'] ?? '').trim();
        const color = String(row['Color'] ?? row['COLOR'] ?? row['color'] ?? '').trim();
        const rawSegment = String(row['Segment'] ?? row['SEGMENT'] ?? '').trim();
        const rawClass = String(row['Class'] ?? row['CLASS'] ?? '').trim();
        const rawSubClass = String(row['SubClass'] ?? row['SUBCLASS'] ?? '').trim();
        const rawLob = String(row['Product'] ?? row['PRODUCT'] ?? '').trim();
        const segment = rawSegment || rawLob || null;
        const pClass = rawClass || null;

        const isTotalRow =
          color.toLowerCase() === 'total' ||
          rawSubClass.toLowerCase() === 'total' ||
          rawClass.toLowerCase() === 'total' ||
          rawLob.toLowerCase() === 'total' ||
          (!serial && !rawSubClass);

        if (isTotalRow) {
          skippedSummaryRows++;
          continue;
        }

        const normStore = rawStore.toUpperCase().replace(/\s+/g, '');
        const storeInfo = storeByPos.get(normStore) || storeByPos.get(rawStore.toUpperCase());

        if (!storeInfo) {
          errors.push({ row: rowNum, posCode: rawStore, sku: '', error: `Unknown Store POS Code: ${rawStore}` });
          continue;
        }

        const productName = (rawSubClass || rawClass || rawLob || 'Apple Product').trim();
        const category = normalizeLobCategory(rawLob || rawClass);

        // Track missing products for batch creation
        const productKey = productName.toUpperCase();
        if (!productByName.has(productKey) && !productBySku.has(productKey) && !missingProductsMap.has(productKey)) {
          let baseSku = generateSkuSlug(category, productName);
          let uniqueSku = baseSku;
          let counter = 1;
          while (productBySku.has(uniqueSku.toUpperCase())) {
            uniqueSku = `${baseSku}-${counter++}`;
          }
          productBySku.set(uniqueSku.toUpperCase(), 'pending');
          missingProductsMap.set(productKey, {
            sku: uniqueSku,
            name: productName,
            category,
            segment,
            class: pClass,
            variant: color || null,
          });
        } else {
          const existingId = productByName.get(productKey) || productBySku.get(productKey);
          if (existingId && !productsToUpdateMeta.has(existingId)) {
            productsToUpdateMeta.set(existingId, { segment, class: pClass });
          }
        }

        // Each valid serialized row = 1 unit count
        const qty = 1;

        if (!storeAggregations.has(storeInfo.id)) {
          storeAggregations.set(storeInfo.id, new Map());
        }
        const storeMap = storeAggregations.get(storeInfo.id)!;
        const current = storeMap.get(productKey) || { count: 0, category };
        current.count += qty;
        storeMap.set(productKey, current);

        validRows++;
        totalUnits += qty;
      }
    } else {
      // Aggregated SKU Format: POS Code, SKU, Quantity, [Low Stock Threshold]
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const posCode = String(row['POS Code'] ?? row['POS_CODE'] ?? row['pos_code'] ?? '').trim();
        const sku = String(row['SKU'] ?? row['sku'] ?? '').trim();
        const qtyRaw = row['Quantity'] ?? row['QUANTITY'] ?? row['quantity'] ?? '';
        if (!posCode && !sku && qtyRaw === '') continue;

        const normPos = posCode.toUpperCase().replace(/\s+/g, '');
        const storeInfo = storeByPos.get(normPos) || storeByPos.get(posCode.toUpperCase());
        const quantity = Number(qtyRaw);

        if (!storeInfo) {
          errors.push({ row: rowNum, posCode, sku, error: `Unknown POS Code: ${posCode}` });
          continue;
        }
        if (qtyRaw === '' || !Number.isInteger(quantity) || quantity < 0) {
          errors.push({ row: rowNum, posCode, sku, error: `Invalid quantity: ${qtyRaw}` });
          continue;
        }

        const skuKey = sku.toUpperCase();
        let productId = productBySku.get(skuKey) || productByName.get(skuKey);

        if (!productId && !missingProductsMap.has(skuKey)) {
          // Auto create missing product for aggregated sku
          missingProductsMap.set(skuKey, {
            sku,
            name: sku,
            category: 'Accessories',
            segment: null,
            class: null,
            variant: null,
          });
        }

        if (!storeAggregations.has(storeInfo.id)) {
          storeAggregations.set(storeInfo.id, new Map());
        }
        const storeMap = storeAggregations.get(storeInfo.id)!;
        storeMap.set(skuKey, { count: quantity, category: 'Accessories' });

        validRows++;
        totalUnits += quantity;
      }
    }

    // DRY RUN PREVIEW RETURN
    if (isDryRun) {
      const storeSummaries: { posCode: string; storeName: string; city: string; skus: number; units: number }[] = [];
      Array.from(storeAggregations.entries()).forEach(([storeId, map]) => {
        const s = allStores.find(st => st.id === storeId);
        const units = Array.from(map.values()).reduce((sum: number, v: { count: number; category: string }) => sum + v.count, 0);
        storeSummaries.push({
          posCode: s?.posCode || storeId,
          storeName: s?.storeName || 'Store',
          city: s?.city || '',
          skus: map.size,
          units,
        });
      });

      return NextResponse.json({
        success: true,
        dryRun: true,
        mode: isErpFormat ? 'ERP_SERIALIZED' : 'AGGREGATED_SKU',
        totalRows: rows.length,
        validRows,
        skippedSummaryRows,
        totalUnits,
        uniqueProductsInFile: missingProductsMap.size,
        newProductsToCreate: missingProductsMap.size,
        storesUpdated: storeAggregations.size,
        storeSummaries,
        errors: errors.slice(0, 100),
        durationMs: Date.now() - startTime,
      });
    }

    // 2. BATCH CREATE MISSING PRODUCTS
    let newProductsCreated = 0;
    const missingList = Array.from(missingProductsMap.values());
    if (missingList.length > 0) {
      const CHUNK = 100;
      for (let i = 0; i < missingList.length; i += CHUNK) {
        const chunk = missingList.slice(i, i + CHUNK).map(m => ({
          sku: m.sku,
          name: m.name,
          category: m.category,
          segment: m.segment,
          class: m.class,
          variant: m.variant,
          active: true,
        }));
        await prisma.product.createMany({
          data: chunk,
          skipDuplicates: true,
        });
        newProductsCreated += chunk.length;
      }

      // Update existing products with segment and class if discovered
      if (productsToUpdateMeta.size > 0) {
        for (const [pId, meta] of Array.from(productsToUpdateMeta.entries())) {
          if (meta.segment || meta.class) {
            await prisma.product.update({
              where: { id: pId },
              data: {
                ...(meta.segment ? { segment: meta.segment } : {}),
                ...(meta.class ? { class: meta.class } : {}),
              },
            }).catch(() => {});
          }
        }
      }

      // Re-populate productByName and productBySku
      const reloadedProducts = await prisma.product.findMany({ select: { id: true, sku: true, name: true } });
      reloadedProducts.forEach(p => {
        productBySku.set(p.sku.trim().toUpperCase(), p.id);
        productByName.set(p.name.trim().toUpperCase(), p.id);
      });
    }

    // 3. BUILD BULK STOCK ITEMS
    const bulkStockItems: BulkStockItem[] = [];

    Array.from(storeAggregations.entries()).forEach(([storeId, map]) => {
      Array.from(map.entries()).forEach(([key, val]) => {
        const productId = productByName.get(key) || productBySku.get(key);
        if (!productId) return;

        const threshold =
          val.category === 'iPhone' ? 5 :
          val.category === 'Mac' ? 3 :
          val.category === 'iPad' ? 3 :
          val.category === 'Watch' ? 3 :
          val.category === 'AirPods' ? 3 :
          Math.max(5, Math.floor(val.count * 0.05));

        bulkStockItems.push({
          storeId,
          productId,
          quantity: val.count,
          lowStockThreshold: threshold,
        });
      });
    });

    // 4. FAST BATCH UPSERT VIA RAW SQL + AUDIT MOVEMENTS
    const bulkResult = await applyBulkStockUpsert(bulkStockItems, {
      reason: 'Import',
      note: `Bulk ${isErpFormat ? 'ERP' : 'SKU'} import: ${file.name} (${bulkStockItems.length} records)`,
      user: auth.user.username || 'admin',
      chunkSize: 100,
    });

    return NextResponse.json({
      success: true,
      mode: isErpFormat ? 'ERP_SERIALIZED' : 'AGGREGATED_SKU',
      totalRows: rows.length,
      imported: validRows,
      skippedSummaryRows,
      totalUnits,
      storesUpdated: storeAggregations.size,
      skusUpdated: bulkResult.count,
      movementsRecorded: bulkResult.movementsCount,
      newProductsCreated,
      durationMs: Date.now() - startTime,
      errors: errors.slice(0, 100),
    });
  } catch (error: any) {
    console.error('POST /api/admin/stock/import error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to process stock file' }, { status: 500 });
  }
}
