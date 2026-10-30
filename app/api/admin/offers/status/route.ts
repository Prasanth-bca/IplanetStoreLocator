import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { todayIST } from '@/lib/leads';
import { offerState } from '@/lib/offers/dates';
import { runningCampaign } from '@/lib/offers/engine';
import { loadAllOffers } from '@/lib/offers/repo';

export const dynamic = 'force-dynamic';

/** Admin: when offers were last imported, what is stored, and what is live today. */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const data = await loadAllOffers();
    const today = todayIST();
    const tally = (rows: { status: string; validFrom: string | null; validUntil: string | null }[]) => {
      const t = { total: rows.length, active: 0, upcoming: 0, expired: 0, inactive: 0 };
      for (const r of rows) {
        if (r.status !== 'Active') t.inactive++;
        else t[offerState(r.validFrom, r.validUntil, today)]++;
      }
      return t;
    };
    return NextResponse.json({
      today,
      lastImport: data.lastImport && { importedAt: data.lastImport.importedAt.toISOString(), fileName: data.lastImport.fileName, importedByName: data.lastImport.importedByName },
      store: tally(data.store),
      bank: tally(data.bank),
      campaigns: data.campaigns,
      runningCampaign: runningCampaign(data.campaigns, today)?.name ?? null,
    });
  } catch (error) {
    console.error('GET /api/admin/offers/status error:', error);
    return NextResponse.json({ error: 'Offer data could not be loaded.' }, { status: 500 });
  }
}
