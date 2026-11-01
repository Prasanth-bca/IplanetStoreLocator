/**
 * Rules for a billing note (a customer billed on a different number from the one the rep dialled).
 * Pure: no database. The same checks run when a note is added and when it is edited.
 */

export const STATUSES = ['NOTED', 'NOT_BILLED', 'BILLED'] as const;
export type NoteStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<NoteStatus, string> = { NOTED: 'Noted', NOT_BILLED: 'Not billed yet', BILLED: 'Billed' };

export interface NoteData {
  bookingDate: string; // YYYY-MM-DD
  billedPhone: string | null; // 10 digits
  dialledPhone: string | null; // 10 digits
  customerName: string | null;
  model: string | null;
  location: string | null;
  status: NoteStatus;
  invoice: string | null;
  value: number | null;
  remarks: string | null;
  agentCode: string | null;
}

export type Checked = { ok: true; data: NoteData } | { ok: false; errors: string[] };

const text = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();
const orNull = (v: unknown): string | null => text(v) || null;

/**
 * An Indian mobile as 10 digits, or null. Accepts "99866 64876", "+91 99866-64876", "099866 64876", "(+91)9986664876".
 * Must start with 6-9, which is how every Indian mobile number starts.
 */
export function normalizePhone(v: unknown): string | null {
  let d = String(v ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** "9986664876" -> "99866 64876" for reading. */
export const formatPhone = (p: string | null | undefined): string => (!p ? '' : p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);

function realDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** Whole rupees from "₹1,23,456", "123456", "89900.00". Blank = null; junk = undefined. */
function rupees(v: unknown): number | null | undefined {
  if (v === null || v === undefined || text(v) === '') return null;
  const n = typeof v === 'number' ? v : Number(text(v).replace(/[₹,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return undefined;
  return Math.round(n);
}

/** `today` is the India calendar date (YYYY-MM-DD); a note can't be dated in the future. */
export function checkNote(raw: Record<string, unknown>, today: string): Checked {
  const errors: string[] = [];
  const E = (m: string) => errors.push(m);

  // Every field is optional. A blank date means today. Anything that IS filled in must still be valid.
  const bookingDate = text(raw.bookingDate) || today;
  if (!realDate(bookingDate)) E('Date is not a real date. Use the date picker.');
  else if (bookingDate > today) E('Date can’t be in the future.');
  else if (bookingDate < '2020-01-01') E('Date is too old. Check the year.');

  const billed = text(raw.billedPhone) ? normalizePhone(raw.billedPhone) : null;
  if (text(raw.billedPhone) && !billed) E('Billed phone number must be a 10-digit mobile number (starting 6 to 9), or leave it blank.');
  const dialled = text(raw.dialledPhone) ? normalizePhone(raw.dialledPhone) : null;
  if (text(raw.dialledPhone) && !dialled) E('Dialled phone number must be a 10-digit mobile number (starting 6 to 9), or leave it blank.');
  if (billed && dialled && billed === dialled) E('The billed and dialled numbers are the same. A note is only needed when the customer was billed on a different number.');

  const model = orNull(raw.model);
  if (model && model.length > 80) E('Model is too long (limit 80 characters).');
  const customerName = orNull(raw.customerName);
  if (customerName && customerName.length > 80) E('Customer name is too long (limit 80 characters).');
  const location = orNull(raw.location)?.toUpperCase() ?? null;
  if (location && !/^[A-Z0-9 _-]{1,20}$/.test(location)) E('Location should be a store code such as TAM or LNK.');
  const invoice = orNull(raw.invoice);
  if (invoice && invoice.length > 40) E('Invoice number is too long (limit 40 characters).');
  const remarks = String(raw.remarks ?? '').trim() || null;
  if (remarks && remarks.length > 500) E('Remarks are too long (limit 500 characters).');
  const agentCode = orNull(raw.agentCode);
  if (agentCode && agentCode.length > 30) E('Agent id is too long (limit 30 characters).');

  const value = rupees(raw.value);
  if (value === undefined) E('Value must be an amount in rupees (numbers only).');

  const statusRaw = text(raw.status || 'NOTED').toUpperCase().replace(/\s+/g, '_');
  const status = STATUSES.find((s) => s === statusRaw);
  if (!status) E('Status must be Noted, Not billed yet, or Billed.');

  // Nothing at all to note would just be an empty row.
  if (!errors.length && !(billed || dialled || model || customerName || location || invoice || remarks || (value ?? null) !== null)) {
    E('Fill in at least one detail (a phone number, name, model, invoice or remark).');
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    data: { bookingDate, billedPhone: billed, dialledPhone: dialled, customerName, model, location, status: status!, invoice, value: value ?? null, remarks, agentCode },
  };
}

/** The search box accepts a phone number (any format), or words for name, model, invoice or remarks. */
export function parseSearch(q: string): { digits: string | null; words: string[] } {
  const t = q.trim();
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 4 && /^[\d\s+()-]+$/.test(t)) return { digits: digits.replace(/^91(?=\d{10}$)/, ''), words: [] };
  return { digits: null, words: t.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6) };
}
