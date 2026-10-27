import { NextRequest, NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { prisma } from '@/lib/prisma';
import { applyStockChanges, StockChange } from '@/lib/stock';

export const dynamic = 'force-dynamic';

/**
 * XLSX/CSV columns: POS Code, SKU, Quantity, (optional) Low Stock Threshold.
 * Valid rows are applied; invalid rows are reported back, matching the store import behaviour.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const workbook = xlsx.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    const rows = xlsx.utils.sheet_to_json<any>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

    const [stores, products] = await Promise.all([
      prisma.store.findMany({ select: { id: true, posCode: true } }),
      prisma.product.findMany({ select: { id: true, sku: true } }),
    ]);
    const storeByPos = new Map(stores.map(s => [s.posCode.toUpperCase(), s.id]));
    const productBySku = new Map(products.map(p => [p.sku.toUpperCase(), p.id]));

    const errors: { row: number; posCode: string; sku: string; error: string }[] = [];
    const byStore = new Map<string, StockChange[]>();
    let valid = 0;

    rows.forEach((row, i) => {
      const rowNum = i + 2;
      const posCode = String(row['POS Code'] ?? row['POS_CODE'] ?? row['pos_code'] ?? '').trim();
      const sku = String(row['SKU'] ?? row['sku'] ?? '').trim();
      const qtyRaw = row['Quantity'] ?? row['QUANTITY'] ?? row['quantity'] ?? '';
      const thrRaw = row['Low Stock Threshold'] ?? row['low_stock_threshold'] ?? '';
      if (!posCode && !sku && qtyRaw === '') return;

      const storeId = storeByPos.get(posCode.toUpperCase());
      const productId = productBySku.get(sku.toUpperCase());
      const quantity = Number(qtyRaw);

      if (!storeId) return void errors.push({ row: rowNum, posCode, sku, error: `Unknown POS Code: ${posCode}` });
      if (!productId) return void errors.push({ row: rowNum, posCode, sku, error: `Unknown SKU: ${sku}` });
      if (qtyRaw === '' || !Number.isInteger(quantity) || quantity < 0) {
        return void errors.push({ row: rowNum, posCode, sku, error: `Invalid quantity: ${qtyRaw}` });
      }
      const change: StockChange = { productId, quantity };
      if (thrRaw !== '') {
        const thr = Number(thrRaw);
        if (!Number.isInteger(thr) || thr < 0) {
          return void errors.push({ row: rowNum, posCode, sku, error: `Invalid threshold: ${thrRaw}` });
        }
        change.lowStockThreshold = thr;
      }
      byStore.set(storeId, [...(byStore.get(storeId) ?? []), change]);
      valid++;
    });

    for (const [storeId, changes] of Array.from(byStore.entries())) {
      await applyStockChanges(storeId, changes, 'Import', `Bulk import: ${file.name}`, 'admin');
    }

    return NextResponse.json({ success: true, totalRows: rows.length, imported: valid, errors });
  } catch (error) {
    console.error('POST /api/admin/stock/import error:', error);
    return NextResponse.json({ error: 'Failed to process stock file' }, { status: 500 });
  }
}
