'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, BadgePercent, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Home, Loader2, RefreshCw, Search, TrendingDown } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { fieldCls } from '@/components/storeLeads/common';
import { copyFailureMessage, copyToClipboard } from '@/lib/clipboard';
import { CATEGORIES, discountPercent, hoursOld, inr, OFFER_KIND_LABEL, offerSaving, offerState, PLATFORMS, platformLabel, platformSearchUrl, priceStatus, shareText, summariseGroup, bestConditional, type OfferKind, type ShareRow } from '@/lib/market/rules';

interface Offer { id: string; kind: string; title: string; bank: string | null; discountAmount: number | null; discountPercent: number | null; minAmount: number | null; maxDiscount: number | null; validFrom: string | null; validUntil: string | null; variants: string | null; terms: string | null; link: string | null }
interface Row { id: string; platform: string; retailerName: string | null; mrp: number | null; sellingPrice: number; availability: string; sourceUrl: string; sourceKind: string; sourceName: string | null; enteredByName: string | null; fetchedAt: string; offers: Offer[] }
interface Group { productKey: string; label: string; category: string; rows: Row[] }
interface Result { serverNow: string; query: string; groups: Group[]; liveSources: string[] }

const SORTS: [string, string][] = [['', 'Platform order'], ['price', 'Lowest price'], ['discount', 'Highest discount']];
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : null);
const ago = (iso: string, now: Date) => { const h = hoursOld(iso, now); return h < 1 ? 'under an hour ago' : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`; };

function offerDescription(o: Offer): string {
  const parts = [o.discountAmount !== null ? `${inr(o.discountAmount)} off` : o.discountPercent !== null ? `${o.discountPercent}% off` : ''];
  if (o.maxDiscount !== null && o.discountAmount === null) parts.push(`up to ${inr(o.maxDiscount)}`);
  if (o.minAmount !== null) parts.push(`min. ${inr(o.minAmount)}`);
  return `${o.bank ? `${o.bank}: ` : ''}${o.title}${parts.filter(Boolean).length ? ` (${parts.filter(Boolean).join(', ')})` : ''}`;
}

function OfferDetails({ o, price, now }: { o: Offer; price: number; now: Date }) {
  const st = offerState(o, now);
  const saving = offerSaving(o as never, price, now);
  const line = (k: string, v: React.ReactNode) => v ? <div className="flex gap-2"><dt className="w-28 shrink-0 text-gray-500">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div> : null;
  return (
    <li className={`rounded-xl border p-3 text-xs ${st === 'ACTIVE' ? 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/5' : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-white/10 dark:bg-white/[0.02]'}`}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{OFFER_KIND_LABEL[o.kind as OfferKind] ?? o.kind}</span>
        {st === 'EXPIRED' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10.5px] font-bold text-red-700">Expired — not counted</span>}
        {st === 'UPCOMING' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">Starts {day(o.validFrom)}</span>}
        {st === 'ACTIVE' && saving > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700">Saves {inr(saving)} on this price</span>}
        {st === 'ACTIVE' && saving === 0 && o.minAmount !== null && price < o.minAmount && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">Needs a bill of {inr(o.minAmount)}+</span>}
      </div>
      <p className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-white">{o.title}</p>
      <dl className="space-y-0.5">
        {line('Eligible bank / card', o.bank)}
        {line('Discount', o.discountAmount !== null ? inr(o.discountAmount) : o.discountPercent !== null ? `${o.discountPercent}%` : o.kind === 'NO_COST_EMI' ? 'No extra interest' : null)}
        {line('Minimum purchase', o.minAmount !== null ? inr(o.minAmount) : null)}
        {line('Maximum discount', o.maxDiscount !== null ? inr(o.maxDiscount) : null)}
        {line('Valid', o.validFrom || o.validUntil ? `${day(o.validFrom) ?? 'now'} to ${day(o.validUntil) ?? 'not stated'}` : 'Validity not stated by the source')}
        {line('Applies to', o.variants)}
        {line('Terms', o.terms)}
        {line('Platform link', o.link ? <a href={o.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-600 underline">Open offer page <ExternalLink className="h-3 w-3" /></a> : null)}
      </dl>
    </li>
  );
}

function GroupCard({ g, now, sort, onRefresh, refreshing }: { g: Group; now: Date; sort: string; onRefresh: (q: string) => void; refreshing: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const summary = useMemo(() => summariseGroup(g.rows as never, now), [g.rows, now]);
  const lines = useMemo(() => {
    const byPlatform = PLATFORMS.filter((p) => p.id !== 'OTHER').map((p) => ({ platform: p.id, row: g.rows.find((r) => r.platform === p.id) ?? null }));
    const others = g.rows.filter((r) => r.platform === 'OTHER').map((r) => ({ platform: 'OTHER', row: r }));
    const all = [...byPlatform, ...others];
    if (sort === 'price') return [...all].sort((a, b) => (a.row?.sellingPrice ?? Infinity) - (b.row?.sellingPrice ?? Infinity));
    if (sort === 'discount') return [...all].sort((a, b) => (discountPercent(b.row?.mrp ?? null, b.row?.sellingPrice ?? 0) ?? -1) - (discountPercent(a.row?.mrp ?? null, a.row?.sellingPrice ?? 0) ?? -1));
    return all;
  }, [g.rows, sort]);
  const name = (l: { platform: string; row: Row | null }) => (l.platform === 'OTHER' && l.row?.retailerName ? l.row.retailerName : platformLabel(l.platform));

  const copy = async () => {
    const rows: ShareRow[] = lines.map((l) => {
      const r = l.row;
      const st = priceStatus(r, now);
      return {
        platformLabel: name(l), status: st, sellingPrice: r?.sellingPrice ?? null, availability: r?.availability ?? 'UNKNOWN',
        offerLines: r ? r.offers.filter((o) => offerState(o, now) === 'ACTIVE').map(offerDescription) : [],
        updatedLabel: r ? when(r.fetchedAt) : '', url: r?.sourceUrl ?? null, isLowest: !!r && summary.lowestRowIds.includes(r.id),
      };
    });
    const res = await copyToClipboard(shareText(g.label, rows));
    setCopied(res.ok ? 'Copied' : copyFailureMessage(res.reason));
    setTimeout(() => setCopied(null), 3000);
  };

  return (
    <section className="rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-950 dark:text-white">{g.label}</h2>
          <p className="text-xs text-gray-500">{g.category} · exact model and storage only</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onRefresh(g.label)} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 hover:text-blue-600 disabled:opacity-60 dark:bg-zinc-800 dark:text-gray-200">{refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh prices</button>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">{copied === 'Copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied === 'Copied' ? 'Copied' : 'Copy for customer'}</button>
        </div>
      </div>
      {copied && copied !== 'Copied' && <p role="alert" className="mt-2 text-xs text-red-600">{copied}</p>}

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Lowest verified price" value={summary.lowestPrice !== null ? inr(summary.lowestPrice) : 'None verified'} tone={summary.lowestPrice !== null ? 'good' : 'plain'} hint={summary.lowestPrice !== null ? summary.lowestRowIds.map((id) => name(lines.find((l) => l.row?.id === id)!)).join(', ') : 'No fresh price available'} />
        <Tile label="Price range" value={summary.spread !== null ? (summary.spread === 0 ? 'Same everywhere' : `${inr(summary.spread)} apart`) : '—'} hint={summary.highestPrice !== null && summary.lowestPrice !== null ? `${inr(summary.lowestPrice)} to ${inr(summary.highestPrice)}` : ''} />
        <Tile label="Best with a card / exchange" value={summary.lowestWithOffer ? inr(summary.lowestWithOffer.price) : '—'} hint={summary.lowestWithOffer ? `${name(lines.find((l) => l.row?.id === summary.lowestWithOffer!.rowId)!)} · conditional` : 'No active conditional offer'} />
        <Tile label="Platforms verified" value={`${summary.verifiedCount} of ${PLATFORMS.length - 1}`} hint={summary.oldCount ? `${summary.oldCount} old · ` + `${summary.unavailableCount} not verified` : `${summary.unavailableCount} not verified`} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="bg-gray-50 text-left text-[10.5px] uppercase tracking-wide text-gray-500 dark:bg-white/5"><th className="px-3 py-2">Platform</th><th className="px-3 py-2">Selling price</th><th className="px-3 py-2">With card / exchange</th><th className="px-3 py-2">Offers</th><th className="px-3 py-2">Updated</th><th className="px-3 py-2" /></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const r = l.row;
              const st = priceStatus(r, now);
              const key = r?.id ?? `${l.platform}-${i}`;
              if (!r) {
                const link = platformSearchUrl(l.platform, g.label);
                return (
                  <tr key={key} className="border-t border-gray-100 dark:border-white/10">
                    <td className="px-3 py-3 font-semibold">{name(l)}</td>
                    <td className="px-3 py-3 text-gray-500" colSpan={4}><span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" />Price could not be verified</span></td>
                    <td className="px-3 py-3 text-right">{link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 underline">Search there <ExternalLink className="h-3 w-3" /></a>}</td>
                  </tr>
                );
              }
              const isLowest = summary.lowestRowIds.includes(r.id);
              const pct = discountPercent(r.mrp, r.sellingPrice);
              const cond = bestConditional(r as never, now);
              const active = r.offers.filter((o) => offerState(o, now) === 'ACTIVE').length;
              return (
                <React.Fragment key={key}>
                  <tr className={`border-t border-gray-100 dark:border-white/10 ${isLowest ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}`}>
                    <td className="px-3 py-3"><p className="font-semibold">{name(l)}</p>{r.sourceKind === 'MANUAL' && <p className="text-[10.5px] text-gray-500">Entered by {r.enteredByName ?? 'admin'}</p>}</td>
                    <td className="px-3 py-3">
                      <p className={`text-base font-extrabold ${st === 'OLD' ? 'text-gray-500' : ''}`}>{inr(r.sellingPrice)}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {r.mrp && r.mrp > r.sellingPrice && <span className="text-gray-400 line-through">{inr(r.mrp)}</span>}
                        {pct !== null && <span className="font-bold text-emerald-700">{pct}% off</span>}
                        {isLowest && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-2 py-0.5 font-bold text-white"><TrendingDown className="h-3 w-3" /> Lowest</span>}
                        {st === 'OLD' && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">Old price — check</span>}
                        {r.availability === 'OUT_OF_STOCK' && <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">Out of stock</span>}
                        {r.availability === 'IN_STOCK' && <span className="text-gray-500">In stock</span>}
                      </div>
                      <p className="text-[10.5px] text-gray-400">Plain price, no card needed</p>
                    </td>
                    <td className="px-3 py-3">{cond ? <><p className="font-bold">{inr(cond.price)}</p><p className="text-[10.5px] text-amber-700">Only with an eligible card / exchange</p></> : <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-3">{r.offers.length ? <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><BadgePercent className="h-3.5 w-3.5" />{active} active{r.offers.length > active ? ` · ${r.offers.length - active} not active` : ''}{open === r.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button> : <span className="text-xs text-gray-400">None listed</span>}</td>
                    <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300">{when(r.fetchedAt)}<p className="text-[10.5px] text-gray-400">{ago(r.fetchedAt, now)}</p></td>
                    <td className="px-3 py-3 text-right"><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 underline">Open page <ExternalLink className="h-3 w-3" /></a></td>
                  </tr>
                  {open === r.id && (
                    <tr className="bg-gray-50/70 dark:bg-white/[0.03]"><td colSpan={6} className="px-3 py-3"><ul className="grid gap-2 md:grid-cols-2">{r.offers.map((o) => <OfferDetails key={o.id} o={o} price={r.sellingPrice} now={now} />)}</ul></td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Tile({ label, value, hint, tone = 'plain' }: { label: string; value: string; hint?: string; tone?: 'plain' | 'good' }) {
  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${tone === 'good' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-gray-100 bg-gray-50/60 dark:border-white/10 dark:bg-white/5'}`}>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold text-gray-950 dark:text-white">{value}</p>
      {hint && <p className="truncate text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

export default function MarketPage() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('');
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [sugg, setSugg] = useState<{ label: string; hasPrices: boolean }[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const box = useRef<HTMLDivElement>(null);

  const search = useCallback(async (text: string, cat: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market/search?q=${encodeURIComponent(text)}${cat ? `&category=${encodeURIComponent(cat)}` : ''}`);
      const b = await res.json().catch(() => ({}));
      if (res.status === 403) { setDenied(true); return; }
      if (!res.ok) throw new Error(b.error || 'Prices could not be loaded.');
      setData(b);
      setNow(new Date(b.serverNow));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prices could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { search(submitted, category); }, [search, submitted, category]);

  useEffect(() => {
    if (q.trim().length < 2) { setSugg([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/market/suggest?q=${encodeURIComponent(q.trim())}`).then((r) => (r.ok ? r.json() : { suggestions: [] })).then((b) => setSugg(b.suggestions ?? [])).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setShowSugg(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const run = (text: string) => { setQ(text); setSubmitted(text.trim()); setShowSugg(false); setNotice(null); };
  const refresh = async (query: string) => {
    setRefreshing(true);
    setNotice(null);
    try {
      const res = await fetch('/api/market/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const b = await res.json().catch(() => ({}));
      setNotice(b.message || b.error || 'Refresh finished.');
      if (res.ok) await search(submitted, category);
    } catch {
      setNotice('Refresh failed. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Searching for something with no saved prices still shows every platform as "could not be verified".
  const groups: Group[] = data ? (data.groups.length || !submitted ? data.groups : [{ productKey: 'q', label: submitted, category: '', rows: [] }]) : [];
  const orderedGroups = useMemo(() => {
    const g = [...groups];
    if (sort === 'price') g.sort((a, b) => (summariseGroup(a.rows as never, now).lowestPrice ?? Infinity) - (summariseGroup(b.rows as never, now).lowestPrice ?? Infinity));
    if (sort === 'discount') g.sort((a, b) => Math.max(-1, ...b.rows.map((r) => discountPercent(r.mrp, r.sellingPrice) ?? -1)) - Math.max(-1, ...a.rows.map((r) => discountPercent(r.mrp, r.sellingPrice) ?? -1)));
    return g;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, sort, submitted]);

  const lastUpdate = data?.groups.flatMap((g) => g.rows).reduce<string | null>((m, r) => (!m || r.fetchedAt > m ? r.fetchedAt : m), null);

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-pal-bar-dark/90 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="Back to home" className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-zinc-800 dark:text-gray-300"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="flex items-center gap-2 truncate text-lg font-extrabold text-gray-950 dark:text-white"><TrendingDown className="h-5 w-5 shrink-0 text-blue-600" /> Market Price &amp; Offers</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Home" title="Home" className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-300"><Home className="h-4 w-4" /></Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8 2xl:px-12">
        {denied ? <p role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Market Price &amp; Offers isn’t enabled for your role. Ask the admin.</p> : (
          <>
            <div className="rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Compare an Apple device’s current online price and offers. Only exact model and storage matches are compared, and a price that needs a card or exchange is never shown as the plain price.</p>
              <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex flex-wrap gap-2">
                <div ref={box} className="relative min-w-0 flex-1 basis-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={q} onChange={(e) => { setQ(e.target.value); setShowSugg(true); }} onFocus={() => setShowSugg(true)} role="combobox" aria-expanded={showSugg && sugg.length > 0} aria-label="Search Apple products" autoComplete="off" placeholder="e.g. iPhone 17 Pro 256GB, MacBook Air M4, AirPods Pro" className={`${fieldCls} pl-9`} />
                  {showSugg && sugg.length > 0 && (
                    <ul role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-pal-card-dark">
                      {sugg.map((s) => <li key={s.label}><button type="button" role="option" aria-selected="false" onClick={() => run(s.label)} className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-white/10"><span>{s.label}</span>{s.hasPrices && <span className="text-[10.5px] font-bold text-emerald-700">prices saved</span>}</button></li>)}
                    </ul>
                  )}
                </div>
                <button type="submit" className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Compare</button>
              </form>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div role="group" aria-label="Category" className="flex flex-wrap gap-1.5">
                  {['', ...CATEGORIES].map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`rounded-full border px-3 py-1 text-xs font-bold transition ${category === c ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300 dark:border-white/10 dark:text-gray-300'}`}>{c || 'All'}</button>)}
                </div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">Sort by
                  <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${fieldCls} !w-auto !py-1.5`}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                </label>
              </div>
              <p className="mt-3 text-[11.5px] text-gray-500">{data?.liveSources.length ? `Live source: ${data.liveSources.join(', ')}. ` : 'No live price feed is connected yet: prices below are the last ones saved by the admin from the retailer’s own page. '}{lastUpdate ? `Latest update: ${when(lastUpdate)}.` : 'Nothing has been saved yet.'}</p>
              {notice && <p role="status" className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">{notice}</p>}
            </div>

            {error && <p role="alert" className="flex items-start gap-2 text-sm text-red-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
            {loading && !data && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}
            {data && !submitted && data.groups.length === 0 && <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/15">No prices have been saved yet. Search for a product to see which platforms still need a verified price.</p>}
            {data && data.groups.length === 0 && submitted && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">No verified prices are saved for “{submitted}”. Nothing is estimated: each platform shows as not verified until a real price is added.</p>}
            {orderedGroups.map((g) => <GroupCard key={g.productKey} g={g} now={now} sort={sort} onRefresh={refresh} refreshing={refreshing} />)}
          </>
        )}
      </main>
    </div>
  );
}
