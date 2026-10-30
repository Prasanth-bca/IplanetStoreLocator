import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { todayIST } from '@/lib/leads';
import { bankOfferMatches, storeOfferMatches } from '@/lib/offers/match';
import { replaceAllOffers } from '@/lib/offers/repo';
import { parseOffersWorkbook, Issue } from '@/lib/offers/workbook';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Admin only. multipart form: `file` (the Offers Master .xlsx) and `mode` = "check" (default) or "import".
 * "check" validates and reports without changing anything. "import" does the same checks and, only if there
 * are no errors, replaces all offers with the file's contents.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const mode = form.get('mode') === 'import' ? 'import' : 'check';
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose the Offers Master Excel file first.' }, { status: 400 });
    if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: 'Please upload an .xlsx Excel file.' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'That file is too large (limit 5 MB).' }, { status: 400 });

    const parsed = parseOffersWorkbook(Buffer.from(await file.arrayBuffer()));
    const warnings: Issue[] = [...parsed.warnings];
    const today = todayIST();

    // Informational checks that need the catalogue; none of these block an import.
    const catalogue = await prisma.product.findMany({ where: { active: true }, select: { sku: true, name: true, class: true, category: true, variant: true } });
    const unmatched = new Set<string>();
    for (const o of parsed.storeOffers) if (!catalogue.some((p) => storeOfferMatches(o, p))) unmatched.add(`${o.category}: ${o.productName}`);
    for (const o of parsed.bankOffers) if (!catalogue.some((p) => bankOfferMatches(o, p))) unmatched.add(`${o.category}: ${o.productName}${o.variant ? ' ' + o.variant : ''}`);

    const expired = [...parsed.storeOffers, ...parsed.bankOffers].filter((o) => o.validUntil && o.validUntil < today).length;
    if (expired) warnings.push({ sheet: '(all)', message: `${expired} offer row(s) have already ended and will never be shown.` });
    const inactive = [...parsed.storeOffers, ...parsed.bankOffers].filter((o) => o.status !== 'Active').length;
    if (inactive) warnings.push({ sheet: '(all)', message: `${inactive} offer row(s) are marked Inactive and will not be shown.` });

    const summary = {
      storeOffers: parsed.storeOffers.length,
      bankRows: parsed.bankRowCount,
      bankOffers: parsed.bankOffers.length,
      campaigns: parsed.campaigns.map((c) => ({ name: c.name, label: c.label, theme: c.theme, startDate: c.startDate, endDate: c.endDate, active: c.active })),
    };

    if (parsed.errors.length > 0) {
      return NextResponse.json({ ok: false, imported: false, mode, summary, errors: parsed.errors, warnings, unmatched: Array.from(unmatched).sort() });
    }
    if (mode === 'import') {
      await replaceAllOffers(parsed, { id: auth.user.id, name: auth.user.name }, file.name, warnings);
    }
    return NextResponse.json({ ok: true, imported: mode === 'import', mode, summary, errors: [], warnings, unmatched: Array.from(unmatched).sort() });
  } catch (error) {
    console.error('POST /api/admin/offers/import error:', error);
    return NextResponse.json({ error: 'The file could not be processed. Nothing was changed.' }, { status: 500 });
  }
}
