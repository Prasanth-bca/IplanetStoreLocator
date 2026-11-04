import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { MISSING_MSG, serializeLead, tableMissing, withLast } from '@/lib/storeLeads/server';
import { timelineOf } from '@/lib/storeLeads/timeline';

export const dynamic = 'force-dynamic';

/** Admin: one lead with its complete history (who shared it, every follow-up, every reminder and when it was answered). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const lead = await prisma.storeLead.findUnique({ where: { id: params.id }, include: withLast });
    if (!lead) return NextResponse.json({ error: 'That lead was not found.' }, { status: 404 });
    return NextResponse.json({ serverNow: new Date().toISOString(), lead: serializeLead(lead, new Date(), 'admin'), timeline: await timelineOf(lead.id, 'admin') });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG }, { status: 503 });
    console.error('GET /api/admin/store-leads/[id] error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The history could not be loaded.' }, { status: 500 });
  }
}
