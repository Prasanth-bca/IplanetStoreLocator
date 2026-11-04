import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { tableMissing } from '@/lib/storeLeads/server';

export const dynamic = 'force-dynamic';

/** Active retail stores for the "Select store" box, each marked with whether it has a store login (only those can receive leads). */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.role === 'STORE') return NextResponse.json({ error: 'You don’t have permission to do this.' }, { status: 403 });
  try {
    const stores = await prisma.store.findMany({ where: { category: 'Retail', status: 'Active' }, orderBy: [{ city: 'asc' }, { storeName: 'asc' }], select: { posCode: true, storeName: true, city: true, area: true, pincode: true } });
    let withAccount = new Set<string>();
    let accountsReady = true;
    try {
      withAccount = new Set((await prisma.storeAccount.findMany({ select: { posCode: true } })).map((a) => a.posCode));
    } catch (e) {
      if (tableMissing(e)) accountsReady = false;
      else throw e;
    }
    return NextResponse.json({ accountsReady, stores: stores.map((s) => ({ ...s, hasAccount: withAccount.has(s.posCode) })) });
  } catch (error) {
    console.error('GET /api/store-leads/stores error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The store list could not be loaded.' }, { status: 500 });
  }
}
