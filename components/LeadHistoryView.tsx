'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Home, MessageCircle, Phone, Search, Users, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { daysInMonth, monthOf, todayIST } from '@/lib/leads';

interface Lead {
  id: string;
  createdAt: string;
  customerName: string;
  customerMobile: string;
  storeName: string;
  posCode: string;
  product: string;
  remarks: string | null;
  channel: string;
  passedBy: string | null;
}

interface History {
  range: { type: 'day' | 'month'; value: string };
  total: number;
  truncated: boolean;
  leads: Lead[];
  byDay: { day: string; count: number }[];
  byStore: { posCode: string; storeName: string; count: number }[];
  byProduct: { product: string; count: number }[];
}

type Mode = 'day' | 'month';

const input =
  'rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40';

/* Calendar arithmetic on YYYY-MM-DD / YYYY-MM keys, independent of the viewer's timezone. */
function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}
function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const IST = 'Asia/Kolkata';
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { timeZone: IST, hour: '2-digit', minute: '2-digit' });
const fmtDayShort = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, day: '2-digit', month: 'short' });
const fmtLongDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtMonthLong = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' });
};
const fmtMobile = (d: string) => (d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : d);

/** Quotes a CSV cell and defuses spreadsheet formulas ("=...", "+...", "-...", "@...") in free text. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export type LeadScope = 'all' | 'mine';

/**
 * Lead history. `all` is the Admin view (everyone's leads, with who passed each);
 * `mine` is a person's own leads. The server decides what each scope may see.
 */
export function LeadHistoryView({ scope }: { scope: LeadScope }) {
  const isAll = scope === 'all';
  const endpoint = isAll ? '/api/admin/leads' : '/api/my/leads';
  const [mode, setMode] = useState<Mode>('day');
  const [day, setDay] = useState(() => todayIST());
  const [month, setMonth] = useState(() => monthOf(todayIST()));
  const [data, setData] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState<string | null>(null);

  const today = todayIST();
  const thisMonth = monthOf(today);
  const value = mode === 'day' ? day : month;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${endpoint}?${mode === 'day' ? `date=${day}` : `month=${month}`}`)
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Failed to load lead history');
        if (!cancelled) setData(body);
      })
      .catch(e => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load lead history'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mode, day, month, reloadKey, endpoint]);

  // A store filter only makes sense within the period it was picked from.
  useEffect(() => setStoreFilter(null), [mode, day, month]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.leads ?? []).filter(l => {
      if (storeFilter && l.posCode !== storeFilter) return false;
      if (!q) return true;
      return `${l.customerName} ${l.customerMobile} ${l.storeName} ${l.posCode} ${l.product} ${l.remarks ?? ''} ${l.passedBy ?? ''}`.toLowerCase().includes(q);
    });
  }, [data, query, storeFilter]);

  const busiestDay = data?.byDay.reduce<{ day: string; count: number } | null>((a, d) => (!a || d.count > a.count ? d : a), null) ?? null;
  const maxDayCount = Math.max(1, ...(data?.byDay.map(d => d.count) ?? [1]));

  const goPrev = () => (mode === 'day' ? setDay(shiftDay(day, -1)) : setMonth(shiftMonth(month, -1)));
  const goNext = () => (mode === 'day' ? setDay(shiftDay(day, 1)) : setMonth(shiftMonth(month, 1)));
  const atPresent = mode === 'day' ? day >= today : month >= thisMonth;

  const downloadCsv = () => {
    if (!visible.length) return;
    const header = ['Date', 'Time', 'Customer', 'Mobile', 'Store', 'POS Code', 'Product / Model', 'Remarks', 'WhatsApp', ...(isAll ? ['Passed by'] : [])];
    const rows = visible.map(l =>
      [
        new Date(l.createdAt).toLocaleDateString('en-CA', { timeZone: IST }),
        fmtTime(l.createdAt),
        l.customerName,
        l.customerMobile,
        l.storeName,
        l.posCode,
        l.product,
        (l.remarks ?? '').replace(/\s*\n\s*/g, ' / '),
        l.channel === 'desktop' ? 'App' : 'Web',
        ...(isAll ? [l.passedBy ?? 'Unknown'] : []),
      ]
        .map(csvCell)
        .join(',')
    );
    // BOM so Excel reads the UTF-8 text (names, en dashes) correctly.
    const blob = new Blob(['﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${isAll ? 'leads' : 'my-leads'}-${value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const heading = mode === 'day' ? fmtLongDay(day) : fmtMonthLong(month);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0c] pb-16">
      <header className="bg-white/90 dark:bg-[#0e0e11]/90 backdrop-blur border-b border-gray-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 2xl:px-12 py-3.5 sticky top-0 z-40">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={isAll ? '/admin' : '/'} className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300" aria-label={isAll ? 'Back to admin' : 'Back to home'}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-extrabold text-gray-950 dark:text-white flex items-center gap-2 truncate">
              <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0" /> {isAll ? 'Lead history' : 'My leads'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Home" title="Home" className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:text-blue-600">
              <Home className="w-4 h-4" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 py-6 space-y-5">
        {/* Period picker */}
        <section className="bg-white dark:bg-[#16161a] rounded-3xl p-5 border border-gray-200/80 dark:border-white/10 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex p-1 rounded-xl bg-gray-200/70 dark:bg-zinc-800" role="group" aria-label="Period type">
              {(['day', 'month'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-lg capitalize transition ${
                    mode === m ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button type="button" onClick={goPrev} aria-label={`Previous ${mode}`} className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {mode === 'day' ? (
                <input
                  type="date"
                  value={day}
                  max={today}
                  onChange={e => e.target.value && setDay(e.target.value)}
                  aria-label="Select date"
                  className={`${input} px-3 py-2`}
                />
              ) : (
                <input
                  type="month"
                  value={month}
                  max={thisMonth}
                  onChange={e => e.target.value && setMonth(e.target.value)}
                  aria-label="Select month"
                  className={`${input} px-3 py-2`}
                />
              )}
              <button
                type="button"
                onClick={goNext}
                disabled={atPresent}
                aria-label={`Next ${mode}`}
                className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {!(mode === 'day' ? day === today : month === thisMonth) && (
              <button
                type="button"
                onClick={() => (mode === 'day' ? setDay(today) : setMonth(thisMonth))}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400"
              >
                {mode === 'day' ? 'Today' : 'This month'}
              </button>
            )}
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-gray-950 dark:text-white">{heading}</h2>
            <p className="text-xs text-gray-500">Times are in India Standard Time.</p>
          </div>

          {!loading && data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-2xl border border-gray-100 dark:border-white/10 px-4 py-3">
                <div className="text-2xl font-extrabold text-gray-900 dark:text-white leading-none">{data.total}</div>
                <div className="text-[11px] font-semibold text-gray-500 mt-1">{isAll ? 'Leads passed' : 'Leads you passed'}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 dark:border-white/10 px-4 py-3">
                <div className="text-2xl font-extrabold text-gray-900 dark:text-white leading-none">{data.byStore.length}</div>
                <div className="text-[11px] font-semibold text-gray-500 mt-1">Stores</div>
              </div>
              <div className="rounded-2xl border border-gray-100 dark:border-white/10 px-4 py-3 min-w-0">
                <div className="text-sm font-extrabold text-gray-900 dark:text-white leading-snug truncate" title={data.byProduct[0]?.product}>
                  {data.byProduct[0]?.product ?? '–'}
                </div>
                <div className="text-[11px] font-semibold text-gray-500 mt-1">Top product{data.byProduct[0] ? ` · ${data.byProduct[0].count}` : ''}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 dark:border-white/10 px-4 py-3">
                {mode === 'month' ? (
                  <>
                    <div className="text-sm font-extrabold text-gray-900 dark:text-white leading-snug">
                      {busiestDay ? `${fmtDayShort(`${busiestDay.day}T12:00:00+05:30`)} · ${busiestDay.count}` : '–'}
                    </div>
                    <div className="text-[11px] font-semibold text-gray-500 mt-1">Busiest day</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-extrabold text-gray-900 dark:text-white leading-snug">
                      {data.leads.length ? `${fmtTime(data.leads[data.leads.length - 1].createdAt)} – ${fmtTime(data.leads[0].createdAt)}` : '–'}
                    </div>
                    <div className="text-[11px] font-semibold text-gray-500 mt-1">First – last lead</div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {loading && (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-white dark:bg-[#16161a] border border-gray-100 dark:border-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="bg-white dark:bg-[#16161a] rounded-2xl p-8 text-center border border-red-200 dark:border-red-900/50">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button onClick={() => setReloadKey(k => k + 1)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && data.total === 0 && (
          <div className="bg-white dark:bg-[#16161a] rounded-3xl p-10 border border-dashed border-gray-300 dark:border-white/15 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {isAll ? 'No leads were passed' : 'You haven’t passed any leads'} {mode === 'day' ? 'on this day' : 'in this month'}
            </p>
            <p className="text-xs text-gray-500 mt-1">Leads appear here when someone clicks “Send to WhatsApp” in the Pass to Store form.</p>
          </div>
        )}

        {!loading && !error && data && data.total > 0 && (
          <>
            {/* Breakdowns */}
            <section className={`grid gap-4 ${mode === 'month' ? 'lg:grid-cols-2' : ''}`}>
              {mode === 'month' && (
                <div className="bg-white dark:bg-[#16161a] rounded-3xl p-5 border border-gray-200/80 dark:border-white/10">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">By day</h3>
                  <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {Array.from({ length: daysInMonth(month) }, (_, i) => {
                      const key = `${month}-${String(i + 1).padStart(2, '0')}`;
                      const count = data.byDay.find(d => d.day === key)?.count ?? 0;
                      if (key > today) return null;
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            disabled={count === 0}
                            onClick={() => {
                              setDay(key);
                              setMode('day');
                            }}
                            className="w-full flex items-center gap-3 text-left group disabled:cursor-default"
                          >
                            <span className="w-14 shrink-0 text-xs font-semibold text-gray-600 dark:text-gray-300 group-enabled:group-hover:text-blue-600">
                              {fmtDayShort(`${key}T12:00:00+05:30`)}
                            </span>
                            <span className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(count / maxDayCount) * 100}%` }} />
                            </span>
                            <span className="w-8 text-right text-xs font-bold tabular-nums text-gray-900 dark:text-white">{count}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="bg-white dark:bg-[#16161a] rounded-3xl p-5 border border-gray-200/80 dark:border-white/10">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">By store</h3>
                <div className="flex flex-wrap gap-2">
                  {data.byStore.map(s => (
                    <button
                      key={s.posCode}
                      type="button"
                      onClick={() => setStoreFilter(f => (f === s.posCode ? null : s.posCode))}
                      aria-pressed={storeFilter === s.posCode}
                      title={s.storeName}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        storeFilter === s.posCode
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                      }`}
                    >
                      <span className="font-mono">{s.posCode}</span>
                      <span className={`px-1.5 rounded-full text-[10px] font-extrabold ${storeFilter === s.posCode ? 'bg-white/25' : 'bg-gray-100 dark:bg-zinc-800'}`}>{s.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Leads list */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={isAll ? 'Search customer, mobile, store, product or person' : 'Search customer, mobile, store or product'}
                    aria-label="Search leads"
                    className={`${input} w-full pl-10 pr-3 py-2.5`}
                  />
                </div>
                {storeFilter && (
                  <button type="button" onClick={() => setStoreFilter(null)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                    Store {storeFilter} <X className="w-3 h-3" />
                  </button>
                )}
                <span className="text-xs font-semibold text-gray-500">
                  Showing {visible.length} of {data.total}
                </span>
                <button
                  type="button"
                  onClick={downloadCsv}
                  disabled={visible.length === 0}
                  className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </button>
              </div>

              {data.truncated && (
                <p className="text-xs text-amber-700 dark:text-amber-300">Showing the newest 5,000 leads for this period. Pick a shorter period to see the rest.</p>
              )}

              {visible.length === 0 ? (
                <div className="bg-white dark:bg-[#16161a] rounded-2xl p-8 text-center border border-gray-100 dark:border-white/10 text-sm text-gray-500">No leads match your search.</div>
              ) : (
                <div className="bg-white dark:bg-[#16161a] rounded-3xl border border-gray-200/80 dark:border-white/10 overflow-hidden">
                  <div className="hidden md:grid grid-cols-[96px_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] gap-4 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-500 bg-gray-50/80 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-white/10">
                    <span>{mode === 'month' ? 'Date · time' : 'Time'}</span>
                    <span>Customer</span>
                    <span>Store</span>
                    <span>Product</span>
                    <span>Remarks</span>
                  </div>
                  <ul className="divide-y divide-gray-100 dark:divide-white/5">
                    {visible.map(l => (
                      <li key={l.id} className="grid grid-cols-1 md:grid-cols-[96px_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)] gap-x-4 gap-y-1 px-5 py-3 hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
                        <div className="text-xs font-semibold text-gray-500 md:pt-0.5">
                          {mode === 'month' && <div className="text-gray-900 dark:text-white">{fmtDayShort(l.createdAt)}</div>}
                          <div className={mode === 'month' ? '' : 'text-sm text-gray-900 dark:text-white'}>{fmtTime(l.createdAt)}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-950 dark:text-white truncate">{l.customerName}</div>
                          <a href={`tel:+91${l.customerMobile}`} className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                            <Phone className="w-3 h-3" /> {fmtMobile(l.customerMobile)}
                          </a>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-gray-800 dark:text-gray-200 truncate">{l.storeName}</div>
                          <div className="text-xs font-mono text-gray-500">{l.posCode}</div>
                          {isAll && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                              Passed by <span className="font-semibold">{l.passedBy ?? 'Unknown'}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-800 dark:text-gray-200 min-w-0 break-words">{l.product}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-line min-w-0 break-words">{l.remarks || '—'}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
