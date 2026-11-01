/** Shared by the list and the Excel export: who may see what, and how the filters become a database query (server only). */

import type { Prisma } from '@prisma/client';
import { isoToDate } from '@/lib/offers/dates';
import { STATUSES } from './validate';
import { parseSearch } from './validate';

export interface Viewer {
  id: string;
  role: 'ADMIN' | 'SALES';
}

export function buildWhere(viewer: Viewer, sp: URLSearchParams, opts: { ignoreStatus?: boolean } = {}): Prisma.BillingNoteWhereInput {
  const and: Prisma.BillingNoteWhereInput[] = [];

  // A sales person sees only their own notes (these are customers' phone numbers); an admin sees everyone's.
  if (viewer.role !== 'ADMIN') and.push({ createdById: viewer.id });
  else if (sp.get('mine') === '1') and.push({ createdById: viewer.id });
  else if (sp.get('agent')) and.push({ createdById: sp.get('agent')! });

  const status = sp.get('status');
  if (!opts.ignoreStatus && status && (STATUSES as readonly string[]).includes(status)) and.push({ status });

  const from = sp.get('from');
  const to = sp.get('to');
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) and.push({ bookingDate: { gte: isoToDate(from) } });
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) and.push({ bookingDate: { lte: isoToDate(to) } });

  const loc = (sp.get('location') || '').trim().toUpperCase();
  if (loc && /^[A-Z0-9 _-]{1,20}$/.test(loc)) and.push({ location: loc });

  const { digits, words } = parseSearch(sp.get('q') || '');
  if (digits) and.push({ OR: [{ billedPhone: { contains: digits } }, { dialledPhone: { contains: digits } }] });
  for (const w of words) {
    and.push({
      OR: [
        { customerName: { contains: w, mode: 'insensitive' } },
        { model: { contains: w, mode: 'insensitive' } },
        { invoice: { contains: w, mode: 'insensitive' } },
        { remarks: { contains: w, mode: 'insensitive' } },
        { agentName: { contains: w, mode: 'insensitive' } },
        { agentCode: { contains: w, mode: 'insensitive' } },
        { location: { contains: w, mode: 'insensitive' } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

type Row = Prisma.BillingNoteGetPayload<object>;
export function serialize(r: Row, viewer: Viewer) {
  return {
    id: r.id,
    bookingDate: r.bookingDate.toISOString().slice(0, 10),
    billedPhone: r.billedPhone,
    dialledPhone: r.dialledPhone,
    customerName: r.customerName,
    model: r.model,
    location: r.location,
    status: r.status,
    invoice: r.invoice,
    value: r.value,
    remarks: r.remarks,
    agentCode: r.agentCode,
    agentName: r.agentName,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    updatedByName: r.updatedByName,
    mine: r.createdById === viewer.id,
    canEdit: viewer.role === 'ADMIN' || r.createdById === viewer.id,
    canDelete: viewer.role === 'ADMIN',
  };
}

/** A friendly answer when the table has not been created yet (Prisma code P2021). */
export const tableMissing = (e: unknown) => (e as { code?: string })?.code === 'P2021';
