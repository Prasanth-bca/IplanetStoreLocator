/**
 * Date helpers for lead history. "Day" and "month" mean calendar days and months in
 * India Standard Time (UTC+5:30, no daylight saving), regardless of where the server runs.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DateRange {
  start: Date; // inclusive
  end: Date; // exclusive
}

/** YYYY-MM-DD for the given instant, as the date shown on a clock in India. */
export function istDateKey(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function todayIST(now: Date = new Date()): string {
  return istDateKey(now);
}

/** The month (YYYY-MM) containing `date` in India. */
export function monthOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function parseParts(value: string, pattern: RegExp): number[] | null {
  const m = pattern.exec(value);
  return m ? m.slice(1).map(Number) : null;
}

/** [00:00, next 00:00) IST for a YYYY-MM-DD date, or null if it isn't a real date. */
export function istDayRange(date: string): DateRange | null {
  const parts = parseParts(date, /^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const [y, mo, d] = parts;
  const utcMidnight = Date.UTC(y, mo - 1, d);
  const check = new Date(utcMidnight);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const start = new Date(utcMidnight - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** First of the month 00:00 IST up to the first of the next month, for YYYY-MM. */
export function istMonthRange(month: string): DateRange | null {
  const parts = parseParts(month, /^(\d{4})-(\d{2})$/);
  if (!parts) return null;
  const [y, mo] = parts;
  if (mo < 1 || mo > 12) return null;
  return {
    start: new Date(Date.UTC(y, mo - 1, 1) - IST_OFFSET_MS),
    end: new Date(Date.UTC(y, mo, 1) - IST_OFFSET_MS),
  };
}

/** Number of days in a YYYY-MM month. */
export function daysInMonth(month: string): number {
  const r = istMonthRange(month);
  return r ? Math.round((r.end.getTime() - r.start.getTime()) / DAY_MS) : 0;
}
