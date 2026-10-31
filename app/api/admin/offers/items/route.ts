import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { todayIST } from '@/lib/leads';
import { createItem, isKind, listItems } from '@/lib/offers/admin-repo';

export const dynamic = 'force-dynamic';

/** Admin: every offer of one kind (store | bank | campaign) with its id and today's state, for the manage screen. */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  const kind = request.nextUrl.searchParams.get('kind');
  if (!isKind(kind)) return NextResponse.json({ error: 'kind must be store, bank or campaign.' }, { status: 400 });
  try {
    const today = todayIST();
    return NextResponse.json({ today, items: await listItems(kind, today) });
  } catch (error) {
    console.error('GET /api/admin/offers/items error:', error);
    return NextResponse.json({ error: 'Offers could not be loaded.' }, { status: 500 });
  }
}

/** Admin: add one offer (or one campaign). Body: { kind, data }. A bank offer may name several banks separated by ";". */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || !isKind(body.kind) || typeof body.data !== 'object' || body.data === null) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const r = await createItem(body.kind, body.data as Record<string, unknown>);
    if (!r.ok) return NextResponse.json({ errors: r.errors }, { status: r.status });
    return NextResponse.json({ id: r.id }, { status: 201 });
  } catch (error) {
    console.error('POST /api/admin/offers/items error:', error);
    return NextResponse.json({ error: 'The offer could not be saved.' }, { status: 500 });
  }
}
