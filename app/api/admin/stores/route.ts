import { NextRequest, NextResponse } from 'next/server';
import { getRetailStores, saveRetailStores, getCareCentres } from '@/lib/storeRepo';
import { Store } from '@/types/store';
import { requireRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'Retail';
  const stores = category === 'Care' ? await getCareCentres() : await getRetailStores();
  return NextResponse.json({ total: stores.length, stores });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const stores = await getRetailStores();

    // Validate POS Code
    const posCode = (body.posCode || '').trim();
    if (!posCode) {
      return NextResponse.json({ error: 'POS Code is required' }, { status: 400 });
    }

    const existing = stores.find(s => s.posCode.toUpperCase() === posCode.toUpperCase());
    if (existing) {
      return NextResponse.json({ error: `Store with POS Code ${posCode} already exists` }, { status: 400 });
    }

    if (!body.storeName || !body.address || !body.city || !body.pincode) {
      return NextResponse.json({ error: 'Store Name, Address, City and PIN Code are required' }, { status: 400 });
    }

    const newStore: Store = {
      id: `store_${Date.now()}`,
      posCode: posCode,
      storeName: body.storeName.trim(),
      storeType: body.storeType || 'Retail',
      category: 'Retail',
      locationType: 'iPlanet Retail Store' as const,
      brand: 'iPlanet',
      address: body.address.trim(),
      area: body.area || body.locality || null,
      locality: body.locality || body.area || null,
      city: body.city.trim(),
      state: body.state || 'Tamil Nadu',
      country: 'India',
      pincode: body.pincode.trim(),
      landmark: body.landmark || null,
      latitude: body.latitude ? parseFloat(body.latitude) : null,
      longitude: body.longitude ? parseFloat(body.longitude) : null,
      phone: body.phone || '080-4699-9888',
      contactPerson: body.contactPerson || 'Store Manager',
      storeManager: body.storeManager || null,
      openingTime: body.openingTime || '10:00 AM',
      closingTime: body.closingTime || '09:30 PM',
      workingDays: body.workingDays || 'Monday to Sunday',
      googlePlaceId: body.googlePlaceId || null,
      googleMapsUrl: body.googleMapsUrl || (body.latitude && body.longitude ? `https://www.google.com/maps/search/?api=1&query=${body.latitude},${body.longitude}` : null),
      status: body.status || 'Active',
      priority: stores.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    stores.push(newStore);
    await saveRetailStores(stores);

    return NextResponse.json({ success: true, store: newStore });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}
