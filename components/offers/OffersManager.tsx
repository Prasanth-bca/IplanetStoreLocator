'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, Loader2, Pencil, Plus, Power, Search, Trash2, X } from 'lucide-react';
import { formatDay } from '@/lib/offers/dates';
import { formatInr, storeValueLabel } from '@/lib/offers/present';
import { BANK_OFFER_TYPES, EMI_TYPES, MATCH_TYPES, OFFER_CATEGORIES, STORE_DISCOUNT_TYPES, THEMES } from '@/lib/offers/types';
import type { BankOfferData, CampaignData, StoreOfferData } from '@/lib/offers/types';

type Kind = 'store' | 'bank' | 'campaign';
type RowState = 'live' | 'upcoming' | 'ended' | 'inactive';
type Data = StoreOfferData | BankOfferData | CampaignData;
interface Item {
  id: string;
  state: RowState;
  data: Data;
}

/* ───────── form definitions ───────── */

interface Field {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: readonly string[];
  hint?: string;
  wide?: boolean;
  list?: string; // datalist id
}
const YES_NO = ['Yes', 'No'] as const;

const STORE_FIELDS: Field[] = [
  { key: 'offerId', label: 'Offer ID', type: 'text', hint: 'Leave blank on a new offer to number it automatically.' },
  { key: 'category', label: 'Product category', type: 'select', options: OFFER_CATEGORIES },
  { key: 'productName', label: 'Product name (model family)', type: 'text', list: 'dl-product', hint: 'Must match the catalogue Class, e.g. “iPhone 17 Pro”.' },
  { key: 'offerType', label: 'Offer type (heading shown)', type: 'text', list: 'dl-offertype', hint: 'e.g. Unconditional Flat Off, Corporate, Special Offer 1' },
  { key: 'tradeIn', label: 'Cashify / trade-in condition', type: 'select', options: ['', 'Without Cashify', 'With Cashify'] },
  { key: 'customer', label: 'Customer category', type: 'text' },
  { key: 'discountType', label: 'Discount type', type: 'select', options: STORE_DISCOUNT_TYPES },
  { key: 'discountValue', label: 'Discount value', type: 'number', hint: 'A number only: 5 means 5%. Leave blank for a text benefit.' },
  { key: 'isUpTo', label: 'Show as “Up to”', type: 'select', options: ['', ...YES_NO] },
  { key: 'combinable', label: 'Combinable with bank offers', type: 'select', options: YES_NO },
  { key: 'offerText', label: 'Offer text (shown to staff)', type: 'text', wide: true },
  { key: 'variant', label: 'Variant (optional)', type: 'text', hint: 'Narrows the offer to one variant.' },
  { key: 'storage', label: 'Storage (optional)', type: 'text' },
  { key: 'validFrom', label: 'Valid from', type: 'date', hint: 'Blank = already started.' },
  { key: 'validUntil', label: 'Valid until', type: 'date', hint: 'Blank = no end date.' },
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
  { key: 'eligibility', label: 'Eligibility', type: 'text', wide: true },
  { key: 'terms', label: 'Terms and conditions', type: 'textarea', wide: true },
  { key: 'source', label: 'Source note', type: 'text', wide: true },
];

const BANK_FIELDS: Field[] = [
  { key: 'offerId', label: 'Offer ID', type: 'text', hint: 'Leave blank on a new offer to number it automatically.' },
  { key: 'bank', label: 'Bank / partner', type: 'text', list: 'dl-bank', hint: 'On a new offer you can type several banks separated by “;”.' },
  { key: 'category', label: 'Product category', type: 'select', options: OFFER_CATEGORIES },
  { key: 'productName', label: 'Product name', type: 'text' },
  { key: 'matchType', label: 'Catalogue match type', type: 'select', options: MATCH_TYPES, hint: 'Exact = the whole model family; Contains all = every word below.' },
  { key: 'matchText', label: 'Catalogue match text', type: 'text', hint: 'e.g. “iPhone 17”, or words separated by “;” such as “MacBook;Pro”.' },
  { key: 'offerType', label: 'Offer type', type: 'select', options: BANK_OFFER_TYPES, wide: true },
  { key: 'emiType', label: 'EMI / non-EMI', type: 'select', options: EMI_TYPES },
  { key: 'cardType', label: 'Card type (optional)', type: 'text' },
  { key: 'amount', label: 'Cashback / benefit amount (₹)', type: 'number' },
  { key: 'percent', label: 'Cashback %', type: 'number' },
  { key: 'minTxn', label: 'Minimum transaction (₹)', type: 'number' },
  { key: 'maxCashback', label: 'Maximum cashback (₹)', type: 'number' },
  { key: 'rvFrom', label: 'Resale value from (₹)', type: 'number', hint: 'Trade-in top-up bands only.' },
  { key: 'rvTo', label: 'Resale value to (₹)', type: 'number' },
  { key: 'details', label: 'Scheme / details (as in the deck)', type: 'textarea', wide: true, hint: 'Loan scheme codes are shown exactly as typed here.' },
  { key: 'variant', label: 'Variant (optional)', type: 'text' },
  { key: 'combinable', label: 'Combinable with store offers', type: 'select', options: YES_NO },
  { key: 'validFrom', label: 'Valid from', type: 'date', hint: 'Blank = already started.' },
  { key: 'validUntil', label: 'Valid until', type: 'date', hint: 'Blank = no end date.' },
  { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
  { key: 'terms', label: 'Terms and conditions', type: 'textarea', wide: true },
  { key: 'source', label: 'Source note', type: 'text', wide: true },
];

const CAMPAIGN_FIELDS: Field[] = [
  { key: 'name', label: 'Campaign name', type: 'text', wide: true },
  { key: 'label', label: 'Panel label', type: 'text', hint: 'Shown on both panels, e.g. DIWALI SPECIAL.' },
  { key: 'theme', label: 'Theme', type: 'select', options: THEMES, hint: 'Diwali switches on the festive look.' },
  { key: 'startDate', label: 'Start date', type: 'date' },
  { key: 'endDate', label: 'End date', type: 'date', hint: 'Both dates are included.' },
  { key: 'active', label: 'Active', type: 'select', options: YES_NO },
];

const FIELDS: Record<Kind, Field[]> = { store: STORE_FIELDS, bank: BANK_FIELDS, campaign: CAMPAIGN_FIELDS };
const BOOL_KEYS = new Set(['isUpTo', 'combinable', 'active']);

const NEW_DEFAULTS: Record<Kind, Record<string, string>> = {
  store: { category: 'iPhone', customer: 'All customers', discountType: 'Percent', isUpTo: 'Yes', combinable: 'Yes', status: 'Active' },
  bank: { category: 'iPhone', matchType: 'Exact', offerType: BANK_OFFER_TYPES[1], emiType: 'Non-EMI', combinable: 'Yes', status: 'Active' },
  campaign: { theme: 'Diwali', active: 'Yes' },
};

const toForm = (data: Data): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) out[k] = v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
  return out;
};

/* ───────── list presentation ───────── */

const STATE_UI: Record<RowState, { label: string; cls: string }> = {
  live: { label: 'Live now', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  upcoming: { label: 'Starting later', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  ended: { label: 'Ended', cls: 'bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-gray-300' },
  inactive: { label: 'Inactive', cls: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
};

function dates(from: string | null, until: string | null): string {
  if (from && until) return `${formatDay(from)} – ${formatDay(until)}`;
  if (from) return `From ${formatDay(from)}`;
  if (until) return `Until ${formatDay(until)}`;
  return 'No dates';
}

interface Summary {
  title: string;
  sub: string;
  value: string;
  valid: string;
  search: string;
  category: string;
  bank: string;
}
function summarise(kind: Kind, d: Data): Summary {
  if (kind === 'store') {
    const o = d as StoreOfferData;
    const lead = [o.offerType, o.tradeIn].filter(Boolean).join(' · ');
    const value = storeValueLabel(o) ?? o.offerText;
    return {
      title: lead, sub: `${o.productName}${o.variant ? ` · ${o.variant}` : ''}${o.storage ? ` · ${o.storage}` : ''}`, value: `${value}${storeValueLabel(o) ? ` — ${o.customer}` : ''}`,
      valid: dates(o.validFrom, o.validUntil), search: `${o.offerId} ${o.productName} ${o.variant ?? ''} ${o.offerType} ${o.customer} ${o.offerText}`, category: o.category, bank: '',
    };
  }
  if (kind === 'bank') {
    const o = d as BankOfferData;
    const value = o.amount ? formatInr(o.amount) : o.percent ? `${o.percent}%` : (o.details ?? '').slice(0, 60);
    return {
      title: `${o.bank}`, sub: `${o.offerType} · ${o.productName}${o.variant ? ` · ${o.variant}` : ''}`, value: o.rvFrom != null ? `${value} (resale ${formatInr(o.rvFrom)}${o.rvTo != null ? ` – ${formatInr(o.rvTo)}` : '+'})` : value,
      valid: dates(o.validFrom, o.validUntil), search: `${o.offerId} ${o.bank} ${o.productName} ${o.offerType} ${o.matchText} ${o.details ?? ''}`, category: o.category, bank: o.bank,
    };
  }
  const c = d as CampaignData;
  return { title: c.name, sub: `${c.label || 'No label'} · ${c.theme} theme`, value: '', valid: dates(c.startDate, c.endDate), search: `${c.name} ${c.label}`, category: '', bank: '' };
}
const idOf = (kind: Kind, d: Data) => (kind === 'campaign' ? '' : (d as StoreOfferData).offerId);

const PAGE = 25;
const input =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white';

const selectCls = input.replace('w-full ', '') + ' w-auto';

/* ───────── component ───────── */

export function OffersManager({ onChanged }: { onChanged: () => void }) {
  const [kind, setKind] = useState<Kind>('store');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [stateFilter, setStateFilter] = useState<'' | RowState>('');
  const [bank, setBank] = useState('');
  const [page, setPage] = useState(0);
  const [editor, setEditor] = useState<{ id: string | null; form: Record<string, string> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const firstField = useRef<HTMLDivElement>(null);

  const load = useCallback(async (k: Kind) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/offers/items?kind=${k}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Offers could not be loaded.');
      setItems(body.items);
      setError(null);
    } catch (e) {
      setItems([]);
      setError(e instanceof Error ? e.message : 'Offers could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(kind);
    setPage(0);
  }, [kind, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const editorOpen = editor !== null;
  useEffect(() => {
    if (!editorOpen) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !saving && setEditor(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [editorOpen, saving]);

  // Focus the first field only when the form opens, never while typing.
  useEffect(() => {
    if (editorOpen) firstField.current?.querySelector<HTMLElement>('input,select,textarea')?.focus();
  }, [editorOpen]);

  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items
      .map((it) => ({ it, s: summarise(kind, it.data) }))
      .filter(({ it, s }) => (!category || s.category === category) && (!stateFilter || it.state === stateFilter) && (!bank || s.bank === bank) && words.every((w) => s.search.toLowerCase().includes(w)));
  }, [items, kind, q, category, stateFilter, bank]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  useEffect(() => setPage((p) => Math.min(p, pages - 1)), [pages]);

  const banks = useMemo(() => (kind === 'bank' ? Array.from(new Set(items.map((i) => (i.data as BankOfferData).bank))).sort() : []), [items, kind]);
  const products = useMemo(() => (kind === 'campaign' ? [] : Array.from(new Set(items.map((i) => (i.data as StoreOfferData).productName))).sort()), [items, kind]);
  const offerTypes = useMemo(() => (kind === 'store' ? Array.from(new Set(items.map((i) => (i.data as StoreOfferData).offerType))).sort() : []), [items, kind]);
  const counts = useMemo(() => {
    const c = { live: 0, upcoming: 0, ended: 0, inactive: 0 };
    items.forEach((i) => c[i.state]++);
    return c;
  }, [items]);

  const openNew = () => {
    setFormErrors([]);
    setEditor({ id: null, form: { ...NEW_DEFAULTS[kind] } });
  };
  const openEdit = (it: Item) => {
    setFormErrors([]);
    setEditor({ id: it.id, form: toForm(it.data) });
  };

  const save = async () => {
    if (!editor) return;
    setSaving(true);
    setFormErrors([]);
    try {
      const res = await fetch(editor.id ? `/api/admin/offers/items/${editor.id}` : '/api/admin/offers/items', {
        method: editor.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, data: editor.form }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormErrors(body.errors ?? [body.error || 'The offer could not be saved.']);
        return;
      }
      setEditor(null);
      setToast({ ok: true, text: editor.id ? 'Changes saved. The panels use them straight away.' : 'Offer added. The panels use it straight away.' });
      await load(kind);
      onChanged();
    } catch {
      setFormErrors(['Something went wrong. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (it: Item) => {
    const on = it.state !== 'inactive';
    setBusyId(it.id);
    try {
      const data = kind === 'campaign' ? { active: !on } : { status: on ? 'Inactive' : 'Active' };
      const res = await fetch(`/api/admin/offers/items/${it.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, data }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body.errors && body.errors[0]) || body.error || 'Could not change the status.');
      setToast({ ok: true, text: on ? 'Switched off. It no longer shows in the panels.' : 'Switched on.' });
      await load(kind);
      onChanged();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : 'Could not change the status.' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (it: Item) => {
    const s = summarise(kind, it.data);
    if (!window.confirm(`Delete “${s.title}${s.sub ? ' · ' + s.sub : ''}” permanently?\n\nTo hide an offer without losing it, use the on/off switch instead.`)) return;
    setBusyId(it.id);
    try {
      const res = await fetch(`/api/admin/offers/items/${it.id}?kind=${kind}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not delete.');
      setToast({ ok: true, text: 'Deleted.' });
      await load(kind);
      onChanged();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : 'Could not delete.' });
    } finally {
      setBusyId(null);
    }
  };

  const set = (key: string, value: string) => setEditor((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e));
  const noun = kind === 'store' ? 'store offer' : kind === 'bank' ? 'bank offer' : 'campaign';

  return (
    <section className="space-y-4 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">View and edit offers</h2>
        <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Add {noun}
        </button>
      </div>

      <div role="tablist" aria-label="Offer type" className="inline-flex rounded-2xl bg-gray-100 p-1 dark:bg-zinc-800/80">
        {([['store', 'Store offers'], ['bank', 'Bank offers'], ['campaign', 'Campaigns']] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            type="button"
            onClick={() => {
              setKind(k);
              setQ('');
              setCategory('');
              setStateFilter('');
              setBank('');
            }}
            className={`rounded-xl px-4 py-1.5 text-xs font-bold transition ${kind === k ? 'bg-white text-blue-700 shadow-sm dark:bg-zinc-700 dark:text-blue-300' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-2xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Changes here take effect immediately. Importing an Excel file later replaces <strong>everything</strong>, including edits made here, so use “Download current offers” first if you want to keep them.</span>
      </p>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search product, bank, offer text, ID…" aria-label="Search offers" className={`${input} pl-9`} />
        </div>
        {kind !== 'campaign' && (
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }} aria-label="Filter by category" className={selectCls}>
            <option value="">All categories</option>
            {OFFER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        {kind === 'bank' && (
          <select value={bank} onChange={(e) => { setBank(e.target.value); setPage(0); }} aria-label="Filter by bank" className={selectCls}>
            <option value="">All banks</option>
            {banks.map((b) => <option key={b}>{b}</option>)}
          </select>
        )}
        <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value as '' | RowState); setPage(0); }} aria-label="Filter by status" className={selectCls}>
          <option value="">All ({items.length})</option>
          <option value="live">Live now ({counts.live})</option>
          <option value="upcoming">Starting later ({counts.upcoming})</option>
          <option value="ended">Ended ({counts.ended})</option>
          <option value="inactive">Inactive ({counts.inactive})</option>
        </select>
      </div>

      {toast && (
        <p role="status" className={`flex items-start gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold ${toast.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'}`}>
          {toast.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />} {toast.text}
        </p>
      )}

      {/* list */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : error ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/15">
          {items.length === 0 ? `No ${noun}s yet. Add one, or import the Excel file below.` : 'Nothing matches these filters.'}
        </p>
      ) : (
        <>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 dark:divide-white/10 dark:border-white/10">
            {shown.map(({ it, s }) => (
              <li key={it.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 bg-white/60 px-4 py-3 dark:bg-white/[0.03] ${it.state === 'inactive' ? 'opacity-70' : ''}`}>
                <div className="min-w-0 flex-1 basis-60">
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.title}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{s.sub}</p>
                  {kind !== 'campaign' && <p className="font-mono text-[10px] text-gray-400">{idOf(kind, it.data)}</p>}
                </div>
                {s.value && <p className="basis-44 text-sm font-semibold text-gray-800 dark:text-gray-100">{s.value}</p>}
                <p className="basis-44 text-xs text-gray-500 dark:text-gray-400">{s.valid}</p>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATE_UI[it.state].cls}`}>{STATE_UI[it.state].label}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => toggle(it)} disabled={busyId === it.id} aria-label={it.state === 'inactive' ? 'Switch on' : 'Switch off'} title={it.state === 'inactive' ? 'Switch on' : 'Switch off (hide from panels)'}
                    className={`rounded-lg p-2 transition disabled:opacity-50 ${it.state === 'inactive' ? 'bg-gray-100 text-gray-500 dark:bg-zinc-800' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>
                    {busyId === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => openEdit(it)} aria-label="Edit" title="Edit" className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"><Pencil className="h-4 w-4" /></button>
                  <button type="button" onClick={() => remove(it)} disabled={busyId === it.id} aria-label="Delete" title="Delete" className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/40 dark:text-red-300"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Showing {page * PAGE + 1}–{Math.min(rows.length, page * PAGE + PAGE)} of {rows.length}</span>
            {pages > 1 && (
              <span className="inline-flex items-center gap-1.5">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold disabled:opacity-40 dark:border-white/10">Previous</button>
                <span>Page {page + 1} of {pages}</span>
                <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold disabled:opacity-40 dark:border-white/10">Next</button>
              </span>
            )}
          </div>
        </>
      )}

      <datalist id="dl-product">{products.map((p) => <option key={p} value={p} />)}</datalist>
      <datalist id="dl-offertype">{offerTypes.map((p) => <option key={p} value={p} />)}</datalist>
      <datalist id="dl-bank">{banks.map((p) => <option key={p} value={p} />)}</datalist>

      {/* editor */}
      {editor && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && !saving && setEditor(null)}>
          <div role="dialog" aria-modal="true" aria-label={editor.id ? `Edit ${noun}` : `Add ${noun}`} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-pal-card-dark sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">{editor.id ? 'Edit' : 'Add'} {noun}</h3>
              <button type="button" onClick={() => setEditor(null)} disabled={saving} aria-label="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>

            <div ref={firstField} className="grid flex-1 grid-cols-1 gap-x-4 gap-y-3.5 overflow-y-auto px-5 py-4 sm:grid-cols-2">
              {FIELDS[kind].map((f) => {
                const id = `of-${f.key}`;
                const v = editor.form[f.key] ?? '';
                return (
                  <div key={f.key} className={f.wide || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <label htmlFor={id} className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">{f.label}</label>
                    {f.type === 'select' ? (
                      <select id={id} value={BOOL_KEYS.has(f.key) && v === '' && f.key !== 'isUpTo' ? 'Yes' : v} onChange={(e) => set(f.key, e.target.value)} className={input}>
                        {f.options!.map((o) => <option key={o} value={o}>{o === '' ? '—' : o}</option>)}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea id={id} rows={3} value={v} onChange={(e) => set(f.key, e.target.value)} className={input} />
                    ) : (
                      <input id={id} type={f.type === 'number' ? 'text' : f.type} inputMode={f.type === 'number' ? 'decimal' : undefined} list={f.list} value={v} onChange={(e) => set(f.key, e.target.value)} className={input} />
                    )}
                    {f.hint && <p className="mt-1 text-[11px] text-gray-400">{f.hint}</p>}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 px-5 py-3.5 dark:border-white/10">
              {formErrors.length > 0 && (
                <ul role="alert" className="mb-3 space-y-1 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {formErrors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditor(null)} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-white/10 dark:text-gray-200">Cancel</button>
                <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editor.id ? 'Save changes' : `Add ${noun}`}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
