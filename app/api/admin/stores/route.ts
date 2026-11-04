import { NextRequest, NextResponse } from 'next/server';
import { getRetailStores, createStore, getCareCentres } from '@/lib/storeRepo';
import { checkStoreFields } from '@/lib/storeInput';
import { prisma } from '@/lib/prisma';
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
    const body = await request.json().catch(() => ({}));
    const posCode = String(body.posCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9 _-]{0,19}$/.test(posCode)) {
      return NextResponse.json({ error: 'Enter a POS code (letters and numbers, e.g. RMM).' }, { status: 400 });
    }
    const checked = checkStoreFields(body);
    if (!checked.ok) return NextResponse.json({ error: checked.errors.join(' '), errors: checked.errors }, { status: 400 });
    const category = body.category === 'Care' ? 'Care' : 'Retail';
    if (await prisma.store.findFirst({ where: { posCode: { equals: posCode, mode: 'insensitive' } }, select: { id: true } })) {
      return NextResponse.json({ error: `A store with POS code ${posCode} already exists.` }, { status: 400 });
    }
    const store = await createStore({ posCode, category, fields: checked.value });
    return NextResponse.json({ success: true, store });
  } catch (err) {
    console.error('POST /api/admin/stores error:', (err as Error)?.message);
    return NextResponse.json({ error: 'The store could not be saved. Please try again.' }, { status: 500 });
  }
}
