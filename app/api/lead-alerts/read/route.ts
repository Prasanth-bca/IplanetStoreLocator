import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStoreAccess, tableMissing } from '@/lib/storeLeads/server';

export const dynamic = 'force-dynamic';

/** The store dismisses reminder pop-ups. Body: { ids: string[] }. Only reminders of its own store can be marked. The lead row keeps pulsing until it gets a response. */
export async function POST(request: NextRequest) {
  const guard = await requireStoreAccess(request);
  if (!guard.ok) return guard.response;
  if (!guard.posCode) return NextResponse.json({ success: true, marked: 0 });
  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string').slice(0, 200) : [];
    if (ids.length === 0) return NextResponse.json({ success: true, marked: 0 });
    const r = await prisma.leadNotification.updateMany({
      where: { id: { in: ids }, posCode: { equals: guard.posCode, mode: 'insensitive' }, readAt: null },
      data: { readAt: new Date(), readByName: guard.user.name },
    });
    return NextResponse.json({ success: true, marked: r.count });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ success: true, marked: 0 });
    console.error('POST /api/lead-alerts/read error:', (error as Error)?.message);
    return NextResponse.json({ error: 'Could not mark as read.' }, { status: 500 });
  }
}
