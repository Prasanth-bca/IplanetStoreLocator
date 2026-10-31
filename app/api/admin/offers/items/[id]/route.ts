import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { deleteItem, isKind, updateItem } from '@/lib/offers/admin-repo';

export const dynamic = 'force-dynamic';

/** Admin: change an offer. Body: { kind, data } where data holds only the fields that changed (or all of them). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => null);
    if (!body || !isKind(body.kind) || typeof body.data !== 'object' || body.data === null) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    const r = await updateItem(body.kind, params.id, body.data as Record<string, unknown>);
    if (!r.ok) return NextResponse.json({ errors: r.errors }, { status: r.status });
    return NextResponse.json({ id: r.id });
  } catch (error) {
    console.error('PATCH /api/admin/offers/items error:', error);
    return NextResponse.json({ error: 'The offer could not be saved.' }, { status: 500 });
  }
}

/** Admin: delete one offer or campaign. ?kind=store|bank|campaign */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  const kind = request.nextUrl.searchParams.get('kind');
  if (!isKind(kind)) return NextResponse.json({ error: 'kind must be store, bank or campaign.' }, { status: 400 });
  try {
    const gone = await deleteItem(kind, params.id);
    if (!gone) return NextResponse.json({ error: 'That offer no longer exists.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/offers/items error:', error);
    return NextResponse.json({ error: 'The offer could not be deleted.' }, { status: 500 });
  }
}
