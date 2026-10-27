import { NextRequest, NextResponse } from 'next/server';
import { searchStores } from '@/lib/storeSearchEngine';
import { StoreCategory } from '@/types/store';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const latStr = searchParams.get('lat') || searchParams.get('latitude');
    const lngStr = searchParams.get('lng') || searchParams.get('longitude');
    const pincode = searchParams.get('pincode') || undefined;
    const limitStr = searchParams.get('limit');
    const categoryParam = searchParams.get('category');
    const category = categoryParam ? (categoryParam as StoreCategory) : undefined;

    const latitude = latStr ? parseFloat(latStr) : undefined;
    const longitude = lngStr ? parseFloat(lngStr) : undefined;
    const limit = limitStr ? parseInt(limitStr) : undefined;

    const result = await searchStores({
      query,
      latitude,
      longitude,
      pincode,
      limit,
      storeCategory: category
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API /api/stores/search error:', error);
    return NextResponse.json(
      { error: 'Internal server error while searching stores' },
      { status: 500 }
    );
  }
}
