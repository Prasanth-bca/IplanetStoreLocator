'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle, Home, Loader2, Pencil, Plus, Save, Trash2, TrendingDown, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { fieldCls } from '@/components/storeLeads/common';
import { AVAILABILITY, CATEGORIES, inr, OFFER_KINDS, OFFER_KIND_LABEL, PLATFORMS, platformLabel, priceStatus } from '@/lib/market/rules';

interface Offer { kind: string; title: string; bank: string; discountAmount: string; discountPercent: string; minAmount: string; maxDiscount: string; validFrom: string; validUntil: string; variants: string; terms: string; link: string }
interface Saved { id: string; productLabel: string; category: string; platform: string; retailerName: string | null; mrp: number | null; sellingPrice: number; availability: string; sourceUrl: string; sourceKind: string; enteredByName: string | null; fetchedAt: string; offers: { kind: string; title: string; bank: string | null; discountAmount: number | null; discountPercent: number | null; minAmount: number | null; maxDiscount: number | null; validFrom: string | null; validUntil: string | null; variants: string | null; terms: string | null; link: string | null }[] }
interface Settings { salesEnabled: boolean; storeEnabled: boolean; tableMissing: boolean; providers: { id: string; name: string; connected: boolean }[] }

const blankOffer = (): Offer => ({ kind: 'BANK', title: '', bank: '', discountAmount: '', discountPercent: '', minAmount: '', maxDiscount: '', validFrom: '', validUntil: '', variants: '', terms: '', link: '' });
const blank = { productLabel: '', category: '', platform: 'AMAZON', retailerName: '', mrp: '', sellingPrice: '', availability: 'IN_STOCK', sourceUrl: '' };
const dateIn = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const n = (v: number | null) => (v === null ? '' : String(v));
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

export default function AdminMarketPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prices, setPrices] = useState<Saved[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const now = new Date();

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([fetch('/api/admin/market/settings').then((r) => r.json()).catch(() => null), fetch('/api/admin/market/prices').then((r) => r.json().then((b) => ({ ok: r.ok, b }))).catch(() => null)]);
    if (s) setSettings(s);
    if (p?.ok) setPrices(p.b.prices);
    else setMsg(p?.b?.error ?? 'Prices could not be loaded.');
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveSettings = async (next: Pick<Settings, 'salesEnabled' | 'storeEnabled'>) => {
    setSettings((s) => (s ? { ...s, ...next } : s));
    const res = await fetch('/api/admin/market/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    const b = await res.json().catch(() => ({}));
    setMsg(res.ok ? 'Access saved.' : b.error || 'Access could not be saved.');
    if (!res.ok) load();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setErrors([]); setDone(null);
    try {
      const res = await fetch('/api/admin/market/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, offers }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setErrors(b.errors ?? [b.error || 'The price could not be saved.']); return; }
      setDone(`Saved ${platformLabel(form.platform)} price for ${form.productLabel}.`);
      setForm({ ...blank, platform: form.platform });
      setOffers([]);
      await load();
    } catch { setErrors(['Something went wrong. Please try again.']); } finally { setSaving(false); }
  };

  const edit = (p: Saved) => {
    setForm({ productLabel: p.productLabel, category: p.category, platform: p.platform, retailerName: p.retailerName ?? '', mrp: n(p.mrp), sellingPrice: String(p.sellingPrice), availability: p.availability, sourceUrl: p.sourceUrl });
    setOffers(p.offers.map((o) => ({ kind: o.kind, title: o.title, bank: o.bank ?? '', discountAmount: n(o.discountAmount), discountPercent: n(o.discountPercent), minAmount: n(o.minAmount), maxDiscount: n(o.maxDiscount), validFrom: dateIn(o.validFrom), validUntil: dateIn(o.validUntil), variants: o.variants ?? '', terms: o.terms ?? '', link: o.link ?? '' })));
    setDone(null); setErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const remove = async (p: Saved) => {
    if (!window.confirm(`Delete the ${platformLabel(p.platform)} price for ${p.productLabel}?`)) return;
    await fetch(`/api/admin/market/prices/${p.id}`, { method: 'DELETE' });
    await load();
  };
  const setOffer = (i: number, k: keyof Offer, v: string) => setOffers((o) => o.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const f = (k: keyof typeof blank) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((x) => ({ ...x, [k]: e.target.value })) });

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-pal-bar-dark/90 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="Back to home" className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-zinc-800 dark:text-gray-300"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="flex items-center gap-2 truncate text-lg font-extrabold text-gray-950 dark:text-white"><TrendingDown className="h-5 w-5 shrink-0 text-blue-600" /> Market Price &amp; Offers — admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/market" className="hidden rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-200 sm:inline-flex">Open the module</Link>
            <Link href="/" aria-label="Home" className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-300"><Home className="h-4 w-4" /></Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8 2xl:px-12">
        {msg && <p role="status" className="rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs font-semibold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">{msg}</p>}
        {settings?.tableMissing && <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">The Market Price tables have not been created yet. Run prisma/manual/market_price.sql first.</p>}

        <section className="max-w-4xl space-y-3 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Who can open it</h2>
          <p className="text-xs text-gray-500">Admins can always open it. Switching a role off hides the home-page card and blocks the page and its data for that role.</p>
          {[['salesEnabled', 'Sales users'], ['storeEnabled', 'Store users']].map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3 text-sm font-semibold dark:border-white/10">
              {label}
              <input type="checkbox" role="switch" className="h-5 w-5 accent-blue-600" disabled={!settings} checked={settings ? settings[k as 'salesEnabled'] : false} onChange={(e) => settings && saveSettings({ salesEnabled: settings.salesEnabled, storeEnabled: settings.storeEnabled, [k]: e.target.checked })} />
            </label>
          ))}
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">
            <p className="font-bold">Live price sources</p>
            {settings && settings.providers.length ? settings.providers.map((p) => <p key={p.id}>{p.name}: {p.connected ? 'connected' : 'not configured'}</p>) : <p>None connected yet. Until one is, Refresh Prices changes nothing and the prices below (typed from the retailer’s own page) are what users see, each marked with who entered it and when.</p>}
          </div>
        </section>

        <form onSubmit={submit} noValidate className="max-w-4xl space-y-4 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
          <div><h2 className="text-base font-bold text-gray-900 dark:text-white">Enter a verified price</h2><p className="text-xs text-gray-500">Copy it from the retailer’s product page and paste that page’s link. Saving the same product and platform again replaces the old price.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold sm:col-span-2">Exact product and storage
              <input {...f('productLabel')} maxLength={120} placeholder="e.g. iPhone 17 Pro 256GB" className={`${fieldCls} mt-1 font-normal`} />
            </label>
            <label className="block text-xs font-bold">Platform
              <select {...f('platform')} className={`${fieldCls} mt-1 font-normal`}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            </label>
            {form.platform === 'OTHER' ? <label className="block text-xs font-bold">Retailer name<input {...f('retailerName')} maxLength={60} className={`${fieldCls} mt-1 font-normal`} /></label> : <label className="block text-xs font-bold">Category <span className="font-normal text-gray-400">(auto if empty)</span>
              <select {...f('category')} className={`${fieldCls} mt-1 font-normal`}><option value="">Auto</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>}
            <label className="block text-xs font-bold">Current selling price (₹)<input {...f('sellingPrice')} inputMode="numeric" placeholder="129900" className={`${fieldCls} mt-1 font-normal`} /></label>
            <label className="block text-xs font-bold">MRP (₹) <span className="font-normal text-gray-400">(optional)</span><input {...f('mrp')} inputMode="numeric" className={`${fieldCls} mt-1 font-normal`} /></label>
            <label className="block text-xs font-bold">Availability
              <select {...f('availability')} className={`${fieldCls} mt-1 font-normal`}>{AVAILABILITY.map((a) => <option key={a} value={a}>{a === 'IN_STOCK' ? 'In stock' : a === 'OUT_OF_STOCK' ? 'Out of stock' : 'Not sure'}</option>)}</select>
            </label>
            <label className="block text-xs font-bold">Product page link (source)<input {...f('sourceUrl')} placeholder="https://www.amazon.in/…" className={`${fieldCls} mt-1 font-normal`} /></label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Offers on this price</h3><button type="button" onClick={() => setOffers((o) => [...o, blankOffer()])} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold dark:bg-zinc-800"><Plus className="h-3.5 w-3.5" /> Add offer</button></div>
            {offers.map((o, i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-gray-100 p-3 dark:border-white/10">
                <div className="flex items-center justify-between gap-2">
                  <select value={o.kind} onChange={(e) => setOffer(i, 'kind', e.target.value)} className={`${fieldCls} !w-auto`} aria-label="Offer type">{OFFER_KINDS.map((k) => <option key={k} value={k}>{OFFER_KIND_LABEL[k]}</option>)}</select>
                  <button type="button" onClick={() => setOffers((x) => x.filter((_, j) => j !== i))} aria-label="Remove offer" className="rounded p-1 text-gray-500 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input value={o.title} onChange={(e) => setOffer(i, 'title', e.target.value)} placeholder="Offer description" aria-label="Offer description" className={`${fieldCls} sm:col-span-2`} />
                  <input value={o.bank} onChange={(e) => setOffer(i, 'bank', e.target.value)} placeholder="Bank / card" aria-label="Bank or card" className={fieldCls} />
                  <input value={o.discountAmount} onChange={(e) => setOffer(i, 'discountAmount', e.target.value)} inputMode="numeric" placeholder="Discount ₹" aria-label="Discount amount" className={fieldCls} />
                  <input value={o.discountPercent} onChange={(e) => setOffer(i, 'discountPercent', e.target.value)} inputMode="decimal" placeholder="or Discount %" aria-label="Discount percent" className={fieldCls} />
                  <input value={o.maxDiscount} onChange={(e) => setOffer(i, 'maxDiscount', e.target.value)} inputMode="numeric" placeholder="Max discount ₹" aria-label="Maximum discount" className={fieldCls} />
                  <input value={o.minAmount} onChange={(e) => setOffer(i, 'minAmount', e.target.value)} inputMode="numeric" placeholder="Min purchase ₹" aria-label="Minimum purchase" className={fieldCls} />
                  <label className="text-[11px] font-semibold text-gray-500">Valid from<input type="date" value={o.validFrom} onChange={(e) => setOffer(i, 'validFrom', e.target.value)} className={`${fieldCls} mt-0.5`} /></label>
                  <label className="text-[11px] font-semibold text-gray-500">Valid until<input type="date" value={o.validUntil} onChange={(e) => setOffer(i, 'validUntil', e.target.value)} className={`${fieldCls} mt-0.5`} /></label>
                  <input value={o.variants} onChange={(e) => setOffer(i, 'variants', e.target.value)} placeholder="Applies to variants" aria-label="Applicable variants" className={fieldCls} />
                  <input value={o.link} onChange={(e) => setOffer(i, 'link', e.target.value)} placeholder="Offer page link" aria-label="Offer link" className={`${fieldCls} sm:col-span-2`} />
                  <textarea value={o.terms} onChange={(e) => setOffer(i, 'terms', e.target.value)} rows={2} placeholder="Terms and conditions" aria-label="Terms" className={`${fieldCls} sm:col-span-3`} />
                </div>
              </div>
            ))}
          </div>

          {errors.length > 0 && <ul role="alert" className="space-y-1 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{errors.map((e, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{e}</li>)}</ul>}
          {done && <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{done}</p>}
          <div className="flex justify-end"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save price</button></div>
        </form>

        <section className="space-y-3 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Saved prices {prices && <span className="text-sm font-normal text-gray-500">· {prices.length}</span>}</h2>
          {!prices ? <Loader2 className="h-5 w-5 animate-spin text-gray-400" /> : prices.length === 0 ? <p className="text-sm text-gray-500">Nothing saved yet.</p> : (
            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/10">
              <table className="w-full min-w-[720px] text-xs">
                <thead><tr className="bg-gray-50 text-left text-[10.5px] uppercase tracking-wide text-gray-500 dark:bg-white/5"><th className="px-3 py-2">Product</th><th className="px-3 py-2">Platform</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2">Offers</th><th className="px-3 py-2">Entered</th><th className="px-3 py-2" /></tr></thead>
                <tbody>{prices.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100 dark:border-white/10">
                    <td className="px-3 py-2 font-semibold">{p.productLabel}</td>
                    <td className="px-3 py-2">{p.retailerName ?? platformLabel(p.platform)}</td>
                    <td className="px-3 py-2 text-right font-mono">{inr(p.sellingPrice)}</td>
                    <td className="px-3 py-2">{p.offers.length}</td>
                    <td className="px-3 py-2 text-gray-500">{p.sourceKind === 'MANUAL' ? p.enteredByName ?? 'admin' : 'Live feed'} · {when(p.fetchedAt)}{priceStatus(p, now) === 'OLD' && <span className="ml-1 font-bold text-amber-700">old</span>}</td>
                    <td className="px-3 py-2 text-right"><button type="button" onClick={() => edit(p)} aria-label="Edit" className="rounded p-1 text-gray-500 hover:text-blue-600"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => remove(p)} aria-label="Delete" className="rounded p-1 text-gray-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
