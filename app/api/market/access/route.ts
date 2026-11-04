import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getMarketAccess, roleMayOpen } from '@/lib/market/server';

export const dynamic = 'force-dynamic';

/** Whether the signed-in person's role may open Market Price & Offers (the home page uses this to show the card). */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ allowed: roleMayOpen(auth.user.role, await getMarketAccess()) });
  } catch {
    return NextResponse.json({ allowed: auth.user.role !== 'STORE' });
  }
}
