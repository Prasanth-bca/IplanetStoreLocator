import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { forgetMarketAccess, getMarketAccess, MISSING_MSG, tableMissing } from '@/lib/market/server';
import { PROVIDERS } from '@/lib/market/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  forgetMarketAccess();
  const a = await getMarketAccess();
  return NextResponse.json({ ...a, providers: PROVIDERS.map((p) => ({ id: p.id, name: p.name, connected: p.configured() })) });
}

export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  const b = await request.json().catch(() => ({}));
  if (typeof b.salesEnabled !== 'boolean' || typeof b.storeEnabled !== 'boolean') return NextResponse.json({ error: 'Choose on or off for each role.' }, { status: 400 });
  try {
    await prisma.marketSetting.upsert({
      where: { id: 'default' },
      update: { salesEnabled: b.salesEnabled, storeEnabled: b.storeEnabled, updatedByName: auth.user.name },
      create: { id: 'default', salesEnabled: b.salesEnabled, storeEnabled: b.storeEnabled, updatedByName: auth.user.name },
    });
    forgetMarketAccess();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG }, { status: 503 });
    return NextResponse.json({ error: 'Settings could not be saved.' }, { status: 500 });
  }
}
