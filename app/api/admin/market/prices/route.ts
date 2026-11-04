import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { MISSING_MSG, savePrice, serializeRow, tableMissing } from '@/lib/market/server';
import { checkPrice } from '@/lib/market/rules';

export const dynamic = 'force-dynamic';

/** Admin: every saved price, newest first. */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const rows = await prisma.marketPrice.findMany({ include: { offers: true }, orderBy: { fetchedAt: 'desc' }, take: 1000 });
    return NextResponse.json({ prices: rows.map((r) => ({ ...serializeRow(r), productLabel: r.productLabel, category: r.category })) });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG, tableMissing: true }, { status: 503 });
    return NextResponse.json({ error: 'Prices could not be loaded.' }, { status: 500 });
  }
}

/** Admin: enter (or replace) a price copied from the retailer's page. Saved as a MANUAL entry with the admin's name and the time. */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const c = checkPrice(body);
  if (!c.ok) return NextResponse.json({ errors: c.errors }, { status: 400 });
  try {
    await savePrice(c.value, { kind: 'MANUAL', enteredByName: auth.user.name });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG }, { status: 503 });
    console.error('POST /api/admin/market/prices error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The price could not be saved.' }, { status: 500 });
  }
}
