import { NextRequest, NextResponse } from 'next/server';
import { ensureReminders, tableMissing } from '@/lib/storeLeads/server';

export const dynamic = 'force-dynamic';

/**
 * Optional scheduler hook: call this every minute from Vercel Cron (Pro plan) or any outside scheduler to create the 20- and 40-minute
 * reminders on time even when nobody has the app open. Send the header "Authorization: Bearer <CRON_SECRET>".
 * Not needed for correctness: reminders are always worked out from each lead's assignment time and created the next time anything checks.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set on the server.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ created: await ensureReminders(new Date(), true) });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: 'Tables not created yet.' }, { status: 503 });
    console.error('GET /api/cron/lead-reminders error:', (error as Error)?.message);
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}
