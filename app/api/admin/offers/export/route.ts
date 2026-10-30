import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireRole } from '@/lib/auth';
import { loadAllOffers } from '@/lib/offers/repo';
import { SHEET_COLUMNS } from '@/lib/offers/workbook';

export const dynamic = 'force-dynamic';

const DATE_FIELDS = new Set(['validFrom', 'validUntil', 'startDate', 'endDate']);
const toSerial = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
};
const yesNo = (v: boolean | null | undefined) => (v === null || v === undefined ? '' : v ? 'Yes' : 'No');

/**
 * Admin: download the offers currently in the app as a workbook in the import format (edit it, then upload it
 * again), or an empty one with just the column headings (?blank=1). Cost and margin data never appears here
 * because it is never stored.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const blank = new URL(request.url).searchParams.get('blank') === '1';
    const data = blank ? { store: [], bank: [], campaigns: [] } : await loadAllOffers();

    const sheet = (columns: { field: string; header: string }[], rows: Record<string, unknown>[]) => {
      const aoa: unknown[][] = [columns.map((c) => c.header)];
      for (const r of rows) {
        aoa.push(
          columns.map(({ field }) => {
            let v = r[field];
            if (field === 'banks') v = r.bank;
            if (field === 'isUpTo' || field === 'combinable' || field === 'active') return yesNo(v as boolean | null);
            if (v === null || v === undefined) return '';
            if (DATE_FIELDS.has(field)) return { t: 'n', v: toSerial(String(v)), z: 'dd-mmm-yyyy' };
            return v;
          })
        );
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = columns.map((c) => ({ wch: Math.max(12, Math.min(40, c.header.length + 2)) }));
      return ws;
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(SHEET_COLUMNS.store, data.store as unknown as Record<string, unknown>[]), 'Store Offers');
    XLSX.utils.book_append_sheet(wb, sheet(SHEET_COLUMNS.bank, data.bank as unknown as Record<string, unknown>[]), 'Bank Offers');
    XLSX.utils.book_append_sheet(wb, sheet(SHEET_COLUMNS.campaign, data.campaigns as unknown as Record<string, unknown>[]), 'Campaign');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${blank ? 'iPlanet_Offers_Blank_Template' : 'iPlanet_Offers_Current'}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/admin/offers/export error:', error);
    return NextResponse.json({ error: 'The export could not be created.' }, { status: 500 });
  }
}
