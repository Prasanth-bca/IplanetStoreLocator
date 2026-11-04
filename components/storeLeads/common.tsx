'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CONVERSION_LABEL, INTEREST_LABEL, STATUS_LABEL, VISIT_LABEL, type Conversion, type Interest, type StatusKey, type Visit } from '@/lib/storeLeads/rules';
import { formatDay } from '@/lib/offers/dates';

export const fieldCls =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white';

/** "4 Nov, 10:32 am" in India time. */
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

export const fmtMobile = (m: string) => (m.length === 10 ? `${m.slice(0, 5)} ${m.slice(5)}` : m);

/** "5 min", "1 h 20 min", "2 days". */
export function fmtWait(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();
  const d = Math.floor(minutes / 1440);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/**
 * The server's idea of "now", kept in step even if this computer's clock is wrong, and ticking every 15 seconds so
 * the "minutes waiting" and the pulsing rows stay current without asking the server again. The server is still the
 * source of truth: this only decides how things look between refreshes.
 */
export function useServerClock(serverNow: string | null) {
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (serverNow) setOffset(new Date(serverNow).getTime() - Date.now());
  }, [serverNow]);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => () => new Date(Date.now() + offset), [offset, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const STATUS_STYLE: Record<StatusKey, string> = {
  NEW: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200',
  FOLLOW_UP: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  CLOSED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  NOT_CLOSED: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  NOT_INTERESTED: 'bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-gray-300',
};

export function StatusBadge({ status }: { status: StatusKey }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const INTEREST_STYLE: Record<Interest, string> = { COLD: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200', WARM: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200', HOT: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200' };

export function InterestPill({ value }: { value: string | null }) {
  if (!value || !(value in INTEREST_LABEL)) return null;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${INTEREST_STYLE[value as Interest]}`}>{INTEREST_LABEL[value as Interest]}</span>;
}

export function VisitText({ value }: { value: string | null }) {
  if (!value || !(value in VISIT_LABEL)) return null;
  return <span className="text-[11px] text-gray-500 dark:text-gray-400">{VISIT_LABEL[value as Visit]}</span>;
}

export const conversionText = (v: string | null) => (v && v in CONVERSION_LABEL ? CONVERSION_LABEL[v as Conversion] : '');

/** A period chooser: one day or one whole month, both in India dates. Calls onChange with the query string to use. */
export function PeriodPicker({ value, onChange, today, allowAll = false }: { value: string; onChange: (query: string) => void; today: string; allowAll?: boolean }) {
  const mode = value.startsWith('month=') ? 'month' : value === 'all=1' ? 'all' : 'day';
  const day = value.startsWith('date=') ? value.slice(5) : today;
  const month = value.startsWith('month=') ? value.slice(6) : today.slice(0, 7);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Period" className="inline-flex rounded-xl bg-gray-100 p-0.5 dark:bg-zinc-800">
        {(['day', 'month', ...(allowAll ? ['all'] : [])] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => onChange(m === 'day' ? `date=${day}` : m === 'month' ? `month=${month}` : 'all=1')}
            className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition ${mode === m ? 'bg-white text-blue-700 shadow-sm dark:bg-zinc-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}
          >
            {m === 'all' ? 'All time' : m}
          </button>
        ))}
      </div>
      {mode === 'day' && <input type="date" aria-label="Day" value={day} max={today} onChange={(e) => e.target.value && onChange(`date=${e.target.value}`)} className={`${fieldCls} w-auto`} />}
      {mode === 'month' && <input type="month" aria-label="Month" value={month} max={today.slice(0, 7)} onChange={(e) => e.target.value && onChange(`month=${e.target.value}`)} className={`${fieldCls} w-auto`} />}
    </div>
  );
}

export const periodLabel = (range: { type: string; value: string } | null) => {
  if (!range) return '';
  if (range.value === 'all') return 'all time';
  if (range.type === 'day') return formatDay(range.value);
  const [y, m] = range.value.split('-');
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' });
};

/** One number with a caption, for the report strips. `tone` draws the eye to things that need action. */
export function Stat({ label, value, tone = 'plain', hint }: { label: string; value: React.ReactNode; tone?: 'plain' | 'bad' | 'warn' | 'good'; hint?: string }) {
  const toneCls = { plain: 'text-gray-950 dark:text-white', bad: 'text-red-600 dark:text-red-400', warn: 'text-amber-600 dark:text-amber-400', good: 'text-emerald-600 dark:text-emerald-400' }[tone];
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white px-3.5 py-3 dark:border-white/10 dark:bg-pal-card-dark" title={hint}>
      <div className={`font-mono text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

/** Calls `fn` now and then every `ms` while the tab is visible; also when the tab comes back into view. */
export function usePolling(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const run = () => document.visibilityState === 'visible' && ref.current();
    const t = setInterval(run, ms);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', run);
    };
  }, [ms]);
}
