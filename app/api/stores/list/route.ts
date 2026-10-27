import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getAllStores } from '@/lib/storeRepo';

export const dynamic = 'force-dynamic';

/** Active retail stores in brief, for the store pickers on the viewer pages. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const stores = (await getAllStores('Retail')).filter(s => s.status === 'Active');
  return NextResponse.json({
    stores: stores.map(s => ({ id: s.id, posCode: s.posCode, storeName: s.storeName, city: s.city, state: s.state, pincode: s.pincode })),
  });
}
