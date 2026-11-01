import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { todayIST } from '@/lib/leads';
import { STATUS_LABEL, NoteStatus } from '@/lib/billing/validate';
import { buildWhere, tableMissing } from '@/lib/billing/query';

export const dynamic = 'force-dynamic';

const serial = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
};

/** Downloads the notes (same filters as the screen) as an Excel sheet laid out like the team's tracker. A rep gets only their own. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const rows = await prisma.billingNote.findMany({
      where: buildWhere({ id: auth.user.id, role: auth.user.role }, request.nextUrl.searchParams),
      orderBy: [{ bookingDate: 'asc' }, { createdAt: 'asc' }],
      take: 5000,
    });
    const header = ['AGENT NAME', 'Agent id', 'BILLED PHONE NUMBER', 'DATE', 'LOCATION', 'MODEL', 'NAME', 'DIALLED PHONE NUMBER', 'Value', 'Invoice', 'STATUS', 'REMARKS'];
    const aoa: unknown[][] = [header];
    for (const r of rows) {
      aoa.push([
        r.agentName, r.agentCode ?? '', r.billedPhone ?? '', { t: 'n', v: serial(r.bookingDate.toISOString().slice(0, 10)), z: 'dd-mm-yyyy' }, r.location ?? '', r.model ?? '',
        r.customerName ?? '', r.dialledPhone ?? '', r.value ?? '', r.invoice ?? '', STATUS_LABEL[r.status as NoteStatus] ?? r.status, r.remarks ?? '',
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [18, 12, 20, 12, 10, 16, 18, 20, 12, 16, 16, 40].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Billing notes');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Billing_Notes_${todayIST()}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: 'The billing notes table has not been created yet.' }, { status: 503 });
    console.error('GET /api/billing-notes/export error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The export could not be created.' }, { status: 500 });
  }
}
