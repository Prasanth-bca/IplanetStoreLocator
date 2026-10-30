/** Date helpers for offers. All dates are India calendar dates written "YYYY-MM-DD"; no time zone maths. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function isRealDate(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Excel stores dates as day counts since 1899-12-30. */
export function fromExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 80000) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10);
}

/**
 * Reads a spreadsheet cell as a date. Accepts an Excel date (number) or text written as
 * 2026-11-14, 14-Nov-2026, 14/11/2026 or 14.11.2026. Returns "YYYY-MM-DD", or null if it isn't a real date.
 */
export function parseDateCell(value: unknown): string | null {
  if (typeof value === 'number') return fromExcelSerial(value);
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value ?? '').trim();
  if (!text) return null;

  let m = ISO.exec(text);
  if (m) return isRealDate(+m[1], +m[2], +m[3]) ? text : null;

  m = /^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]*(\d{4})$/.exec(text);
  if (m) {
    const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
    return month && isRealDate(+m[3], month, +m[1]) ? `${m[3]}-${pad(month)}-${pad(+m[1])}` : null;
  }

  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(text); // day first, as used in India
  if (m) return isRealDate(+m[3], +m[2], +m[1]) ? `${m[3]}-${pad(+m[2])}-${pad(+m[1])}` : null;

  return null;
}

/** A database DATE (UTC midnight) back to "YYYY-MM-DD". */
export function dateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" to a Date at UTC midnight, the form Prisma stores for a DATE column. */
export function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export type OfferState = 'active' | 'upcoming' | 'expired';

/** Both ends are inclusive. A missing start date means already started; a missing end date means no end. Compares plain strings, which sort correctly. */
export function offerState(validFrom: string | null, validUntil: string | null, today: string): OfferState {
  if (validFrom && today < validFrom) return 'upcoming';
  if (validUntil && today > validUntil) return 'expired';
  return 'active';
}

/** "14 Nov 2026" */
export function formatDay(iso: string): string {
  const m = ISO.exec(iso);
  if (!m) return iso;
  return `${+m[3]} ${MONTHS[+m[2] - 1][0].toUpperCase()}${MONTHS[+m[2] - 1].slice(1)} ${m[1]}`;
}
