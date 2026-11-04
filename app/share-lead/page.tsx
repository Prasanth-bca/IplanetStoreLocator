'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle, History, Home, Loader2, Search, Send, Share2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCurrentUser } from '@/lib/useCurrentUser';
import type { StatusKey, Summary } from '@/lib/storeLeads/rules';
import { fieldCls, fmtDateTime, fmtMobile, InterestPill, PeriodPicker, periodLabel, Stat, StatusBadge, usePolling, VisitText } from '@/components/storeLeads/common';
import { todayInIndia } from '@/lib/storeLeads/clientDates';

interface StoreOpt { posCode: string; storeName: string; city: string; area: string | null; pincode: string; hasAccount: boolean }
interface SharedLead {
  id: string; customerName: string; customerMobile: string; requirement: string; remarks: string | null; assignedAt: string; posCode: string; storeName: string;
  interest: string | null; visitIntention: string | null; conversion: string | null; status: StatusKey; lastRemark: string | null; minutesWaiting: number | null; reminderLevel: number;
}
interface StoreRow extends Summary { posCode: string; label: string }
interface Listing { serverNow: string; range: { type: 'day' | 'month'; value: string }; total: number; truncated: boolean; summary: Summary; byStore: StoreRow[]; leads: SharedLead[] }

const CATEGORIES = ['iPhone', 'MacBook', 'iPad', 'Apple Watch', 'AirPods', 'iMac', 'Accessories'];
const FILTERS: [string, string][] = [['', 'All'], ['NEW', 'Awaiting store response'], ['FOLLOW_UP', 'In follow-up'], ['CLOSED', 'Closed'], ['NOT_CLOSED', 'Not Closed'], ['NOT_INTERESTED', 'Not Interested']];
const newClientId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

export default function ShareLeadPage() {
  const { user } = useCurrentUser();
  const today = useMemo(() => todayInIndia(), []);
  // form
  const [clientId, setClientId] = useState(newClientId);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [need, setNeed] = useState('');
  const [remarks, setRemarks] = useState('');
  const [posCode, setPosCode] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [accountsReady, setAccountsReady] = useState(true);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  // list
  const [period, setPeriod] = useState(`date=${today}`);
  const [status, setStatus] = useState('');
  const [data, setData] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/store-leads/stores')
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!b) return;
        setStores(b.stores ?? []);
        setAccountsReady(b.accountsReady !== false);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/store-leads?${period}${status ? `&status=${status}` : ''}`);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || 'Your shared leads could not be loaded.');
      setData(b);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Your shared leads could not be loaded.');
    }
  }, [period, status]);
  useEffect(() => {
    load();
  }, [load]);
  usePolling(load, 45_000);

  const visibleStores = useMemo(() => {
    const words = storeFilter.toLowerCase().split(/\s+/).filter(Boolean);
    return stores.filter((s) => !words.length || words.every((w) => `${s.posCode} ${s.storeName} ${s.city} ${s.area ?? ''} ${s.pincode}`.toLowerCase().includes(w)));
  }, [stores, storeFilter]);
  const byCity = useMemo(() => {
    const m = new Map<string, StoreOpt[]>();
    visibleStores.forEach((s) => m.set(s.city, [...(m.get(s.city) ?? []), s]));
    return Array.from(m.entries());
  }, [visibleStores]);
  const chosen = stores.find((s) => s.posCode === posCode);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setErrors([]);
    setDone(null);
    try {
      const res = await fetch('/api/store-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, customerName: name, customerMobile: mobile, requirement: need, remarks, posCode }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(b.errors ?? [b.error || 'The lead could not be shared.']);
        return;
      }
      setDone(`${b.duplicate ? 'This lead was already shared with' : 'Lead shared with'} ${b.storeName ?? chosen?.storeName ?? 'the store'}. The store is reminded automatically if it doesn’t respond within 20 minutes.`);
      setName('');
      setMobile('');
      setNeed('');
      setRemarks('');
      setClientId(newClientId());
      await load();
    } catch {
      setErrors(['Something went wrong. Please check your connection and try again.']);
    } finally {
      setSending(false);
    }
  };

  const s = data?.summary;
  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-pal-bar-dark/90 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="Back to home" className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-zinc-800 dark:text-gray-300"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="flex items-center gap-2 truncate text-lg font-extrabold text-gray-950 dark:text-white"><Share2 className="h-5 w-5 shrink-0 text-blue-600" /> Share a lead with a store</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/my-leads" className="hidden items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-200 sm:inline-flex"><History className="h-3.5 w-3.5" /> Lead history</Link>
            <Link href="/" aria-label="Home" title="Home" className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-300"><Home className="h-4 w-4" /></Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8 2xl:px-12">
        <form onSubmit={submit} noValidate className="max-w-4xl space-y-4 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">New lead</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">The store you pick receives it on its own dashboard, and it is saved in your lead history{user ? ` as ${user.name}` : ''}.</p>
          </div>
          {!accountsReady && <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Store logins have not been set up yet, so leads can’t be shared. Ask the admin.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Customer name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" placeholder="e.g. Nikitha R" className={`${fieldCls} mt-1 font-normal`} />
            </label>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Customer contact number
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" autoComplete="off" placeholder="The number you called" className={`${fieldCls} mt-1 font-normal`} />
            </label>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Customer requirement
                <input value={need} onChange={(e) => setNeed(e.target.value)} maxLength={120} autoComplete="off" placeholder="Device or product, e.g. iPhone 17 Pro 256GB" className={`${fieldCls} mt-1 font-normal`} />
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Quick picks">
                {CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setNeed((v) => (v.trim() ? v : `${c} `))} className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:text-gray-300">{c}</button>)}
              </div>
            </div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 sm:col-span-2">Remarks <span className="font-normal text-gray-400">(optional)</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} maxLength={500} placeholder="What you discussed with the customer, budget, when they plan to buy…" className={`${fieldCls} mt-1 font-normal`} />
            </label>
            <div className="sm:col-span-2">
              <label htmlFor="store-pick" className="block text-xs font-bold text-gray-700 dark:text-gray-300">Select store</label>
              <div className="mt-1 grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} aria-label="Filter stores" placeholder="Filter: area, PIN, code" className={`${fieldCls} pl-9`} /></div>
                <select id="store-pick" value={posCode} onChange={(e) => setPosCode(e.target.value)} className={fieldCls}>
                  <option value="">{stores.length ? 'Choose the store that should get this lead' : 'Loading stores…'}</option>
                  {byCity.map(([city, list]) => (
                    <optgroup key={city} label={city}>
                      {list.map((st) => <option key={st.posCode} value={st.posCode} disabled={!st.hasAccount}>{st.posCode} · {st.storeName}{st.area ? ` (${st.area})` : ''}{st.hasAccount ? '' : ' (no store login yet)'}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              {storeFilter && visibleStores.length === 0 && <p className="mt-1 text-[11px] text-amber-700">No store matches “{storeFilter}”.</p>}
            </div>
          </div>

          {errors.length > 0 && <ul role="alert" className="space-y-1 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{errors.map((e, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{e}</li>)}</ul>}
          {done && <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{done}</p>}
          <div className="flex justify-end"><button type="submit" disabled={sending} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Share lead with store</button></div>
        </form>

        <section className="space-y-3 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Leads I shared <span className="text-sm font-normal text-gray-500">· {data ? periodLabel(data.range) : ''}</span></h2>
            <PeriodPicker value={period} onChange={setPeriod} today={today} allowAll />
          </div>
          {loadError ? <p role="alert" className="flex items-start gap-2 text-sm text-red-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{loadError}</p> : !data ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div> : (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Total shared" value={s!.total} /><Stat label="Closed" value={s!.closed} tone={s!.closed ? 'good' : 'plain'} /><Stat label="Not Closed" value={s!.notClosed} />
                <Stat label="Not Interested" value={s!.notInterested} /><Stat label="Awaiting store" value={s!.pendingFirstResponse} tone={s!.pendingFirstResponse ? 'warn' : 'plain'} /><Stat label="Conversion" value={`${s!.conversionPercent}%`} tone={s!.closed ? 'good' : 'plain'} />
              </div>
              {data.byStore.length > 0 && (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/10">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead><tr className="bg-gray-50 text-left text-[10.5px] uppercase tracking-wide text-gray-500 dark:bg-white/5"><th className="px-3 py-2">Store</th><th className="px-3 py-2 text-right">Shared</th><th className="px-3 py-2 text-right">Closed</th><th className="px-3 py-2 text-right">Not Closed</th><th className="px-3 py-2 text-right">Not Interested</th><th className="px-3 py-2 text-right">Conversion</th></tr></thead>
                    <tbody>{data.byStore.map((r) => <tr key={r.posCode} className="border-t border-gray-100 dark:border-white/10"><td className="px-3 py-2 font-semibold">{r.label}</td><td className="px-3 py-2 text-right font-mono">{r.total}</td><td className="px-3 py-2 text-right font-mono">{r.closed}</td><td className="px-3 py-2 text-right font-mono">{r.notClosed}</td><td className="px-3 py-2 text-right font-mono">{r.notInterested}</td><td className="px-3 py-2 text-right font-mono font-bold">{r.conversionPercent}%</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
                {FILTERS.map(([k, label]) => <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)} className={`rounded-full border px-3 py-1 text-xs font-bold transition ${status === k ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300 dark:border-white/10 dark:text-gray-300'}`}>{label}</button>)}
              </div>
              {data.leads.length === 0 ? <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/15">{status ? 'No leads with this status.' : 'You haven’t shared any lead in this period.'}</p> : (
                <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 dark:divide-white/10 dark:border-white/10">
                  {data.leads.map((l) => (
                    <li key={l.id} className="grid gap-x-4 gap-y-1.5 bg-white/60 px-4 py-3 text-sm dark:bg-white/[0.03] md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                      <div className="min-w-0"><p className="truncate font-bold">{l.customerName}</p><p className="font-mono text-xs text-gray-500">{fmtMobile(l.customerMobile)}</p></div>
                      <div className="min-w-0"><p className="break-words font-medium">{l.requirement}</p><p className="truncate text-xs text-gray-500">{l.posCode} · {l.storeName}</p></div>
                      <p className="text-xs text-gray-500">{fmtDateTime(l.assignedAt)}</p>
                      <div className="min-w-0 text-xs text-gray-600 dark:text-gray-300"><p className="whitespace-pre-wrap break-words">{l.lastRemark || <span className="text-gray-300">No store remark yet</span>}</p><div className="mt-1 flex flex-wrap items-center gap-2"><InterestPill value={l.interest} /><VisitText value={l.visitIntention} /></div></div>
                      <div><StatusBadge status={l.status} />{l.status === 'NEW' && l.reminderLevel > 0 && <p className="mt-1 text-[11px] font-bold text-red-600">Waiting {l.minutesWaiting} min</p>}</div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
