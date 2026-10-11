import { NextRequest, NextResponse } from 'next/server';
import { getRetailStores, saveRetailStores } from '@/lib/storeRepo';
import { Store } from '@/types/store';
import * as xlsx from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json<any>(sheet, { defval: '' });

    const existingStores = getRetailStores();
    const existingPosMap = new Set(existingStores.map(s => s.posCode.toUpperCase()));

    const importedStores: Store[] = [];
    const errors: { row: number; posCode: string; error: string }[] = [];
    let duplicatesCount = 0;

    rawData.forEach((row, index) => {
      const rowNum = index + 2; // header is row 1
      const posCode = String(row['POS Code'] || row['POS_CODE'] || row['pos_code'] || '').trim();
      const storeName = String(row['Store Name'] || row['STORE_NAME'] || row['store_name'] || '').trim();
      const address = String(row['Full Address'] || row['ADDRESS'] || row['address'] || '').trim();
      const pincode = String(row['PIN Code'] || row['PINCODE'] || row['pincode'] || '').trim().replace(/[^\d]/g, '');
      const stateCity = String(row['State / City'] || row['CITY'] || row['city'] || '').trim();
      const area = String(row['Area / Locality'] || row['AREA'] || row['area'] || '').trim();
      const landmark = String(row['Landmark'] || row['LANDMARK'] || row['landmark'] || '').trim();

      if (!posCode && !storeName) return; // empty row

      if (!posCode) {
        errors.push({ row: rowNum, posCode: '', error: 'Missing POS Code' });
        return;
      }

      if (existingPosMap.has(posCode.toUpperCase())) {
        duplicatesCount++;
        errors.push({ row: rowNum, posCode, error: `Duplicate POS Code: ${posCode} already exists in master` });
        return;
      }

      if (!pincode || pincode.length !== 6) {
        errors.push({ row: rowNum, posCode, error: `Invalid 6-digit PIN code: ${pincode}` });
        return;
      }

      let city = stateCity;
      let state = 'Tamil Nadu';
      if (stateCity.includes('/')) {
        const parts = stateCity.split('/');
        state = parts[0].trim();
        city = parts[1].trim();
      }

      const newStore: Store = {
        id: `store_${Date.now()}_${index}`,
        posCode,
        storeName: storeName || `iPlanet ${posCode}`,
        storeType: 'Retail',
        category: 'Retail',
        brand: 'iPlanet',
        address: address || `iPlanet Store, ${area}, ${city} - ${pincode}`,
        area: area || null,
        locality: area || null,
        city: city || 'Chennai',
        state: state || 'Tamil Nadu',
        country: 'India',
        pincode,
        landmark: landmark || null,
        latitude: null,
        longitude: null,
        phone: '080-4699-9888',
        contactPerson: 'Store Manager',
        storeManager: null,
        openingTime: '10:00 AM',
        closingTime: '09:30 PM',
        workingDays: 'Monday to Sunday',
        googlePlaceId: null,
        googleMapsUrl: null,
        status: 'Active',
        priority: existingStores.length + importedStores.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      existingPosMap.add(posCode.toUpperCase());
      importedStores.push(newStore);
    });

    if (importedStores.length > 0) {
      const merged = [...existingStores, ...importedStores];
      saveRetailStores(merged);
    }

    return NextResponse.json({
      success: true,
      totalRows: rawData.length,
      validImported: importedStores.length,
      duplicatesCount,
      errorsCount: errors.length,
      errors
    });
  } catch (err: any) {
    console.error('Import error:', err);
    return NextResponse.json({ error: 'File processing failed: ' + err.message }, { status: 500 });
  }
}
