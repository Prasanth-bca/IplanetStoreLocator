'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Home,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  Download,
  History,
  Loader2,
  MapPin,
  Package,
  Save,
  Search,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CategoryIcon, liveStatus, Status, StatusPill, STATUS_META, timeAgo } from '@/components/stockUi';
import { ViewToggle, useViewMode } from '@/components/ViewToggle';
import { Store } from '@/types/store';

interface Row {
  productId: string;
  sku: string;
  name: string;
  category: string;
  variant: string | null;
  quantity: number | null;
  lowStockThreshold: number;
  status: Status;
  updatedAt: string | null;
}

interface Movement {
  id: string;
  name: string;
  variant: string | null;
  delta: number;
  newQty: number;
  reason: string;
  note: string | null;
  createdAt: string;
}

type Edit = { qty?: string; thr?: string };

const REASONS = ['Received', 'Sold', 'Transfer', 'Correction'];

const input =
  'rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40';

const chip = (active: boolean) =>
  `shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
    active
      ? 'bg-blue-600 border-blue-600 text-white'
      : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:border-blue-400'
  }`;

/* ───────────── Searchable store picker ───────────── */
function StorePicker({ stores, value, onPick }: { stores: Store[]; value: Store | null; onPick: (s: Store) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t
      ? stores.filter(s => `${s.posCode} ${s.storeName} ${s.city} ${s.pincode}`.toLowerCase().includes(t))
      : stores;
    return list.slice(0, 40);
  }, [stores, q]);

  return (
    <div ref={box} className="relative w-full sm:max-w-md">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${input} w-full flex items-center justify-between gap-2 px-4 py-3 text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate">
          {value ? (
            <>
              <span className="font-mono font-bold">{value.posCode}</span>
              <span className="text-gray-500"> · {value.storeName}</span>
            </>
          ) : (
            <span className="text-gray-500">Search stores by POS code, name or city…</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#16161a] shadow-xl overflow-hidden">
          <div className="relative p-2 border-b border-gray-100 dark:border-white/10">
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Type to filter…"
              className={`${input} w-full pl-9 pr-3 py-2`}
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {matches.length === 0 && <li className="px-4 py-6 text-sm text-gray-500 text-center">No stores match “{q}”.</li>}
            {matches.map(s => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value?.id === s.id}
                  onClick={() => {
                    onPick(s);
                    setOpen(false);
                    setQ('');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">{s.storeName}</span>
                    <span className="block text-xs text-gray-500">{s.city}</span>
                  </span>
                  <span className="font-mono text-xs font-bold bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-lg shrink-0">{s.posCode}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function StockAdminPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [store, setStore] = useState<Store | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [reason, setReason] = useState('Correction');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [tab, setTab] = useState<'stock' | 'history'>('stock');
  const [history, setHistory] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useViewMode('admin-stock-view');
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch('/api/admin/stores?category=Retail')
      .then(r => r.json())
      .then(d => setStores(d.stores || []));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.type === 'ok' ? 3500 : 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadStock = useCallback(async (code: string) => {
    setLoading(true);
    setEdits({});
    try {
      const [s, h] = await Promise.all([
        fetch(`/api/admin/stock/${encodeURIComponent(code)}`).then(r => r.json()),
        fetch(`/api/admin/stock/${encodeURIComponent(code)}/history`).then(r => r.json()),
      ]);
      setRows(s.items || []);
      setHistory(h.history || []);
    } catch {
      setToast({ type: 'err', text: 'Could not load stock for this store.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const dirty = useMemo(
    () =>
      rows.flatMap(r => {
        const e = edits[r.productId];
        if (!e) return [];
        const out: { productId: string; quantity?: number; lowStockThreshold?: number } = { productId: r.productId };
        if (e.qty !== undefined && e.qty !== '' && parseInt(e.qty) !== r.quantity) out.quantity = parseInt(e.qty);
        if (e.thr !== undefined && e.thr !== '' && parseInt(e.thr) !== r.lowStockThreshold) out.lowStockThreshold = parseInt(e.thr);
        return out.quantity !== undefined || out.lowStockThreshold !== undefined ? [out] : [];
      }),
    [rows, edits]
  );
  const dirtyIds = useMemo(() => new Set(dirty.map(d => d.productId)), [dirty]);

  // Warn before the tab is closed with unsaved edits.
  useEffect(() => {
    if (dirty.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty.length]);

  const pickStore = (s: Store) => {
    if (dirty.length > 0 && !window.confirm(`Discard ${dirty.length} unsaved change(s) and switch store?`)) return;
    setStore(s);
    setTab('stock');
    setQuery('');
    setCategory('All');
    setStatusFilter('all');
    loadStock(s.posCode);
  };

  const setEdit = (id: string, patch: Edit) => setEdits(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const bump = (r: Row, by: number) => {
    const current = edits[r.productId]?.qty ?? String(r.quantity ?? 0);
    setEdit(r.productId, { qty: String(Math.max(0, (parseInt(current) || 0) + by)) });
  };

  const save = useCallback(async () => {
    if (!store || dirty.length === 0 || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/stock/${encodeURIComponent(store.posCode)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: dirty, reason, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setToast({ type: 'ok', text: `Saved ${data.updated} change${data.updated === 1 ? '' : 's'} to ${store.posCode}.` });
      setNote('');
      await loadStock(store.posCode);
    } catch (e) {
      setToast({ type: 'err', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }, [store, dirty, saving, reason, note, loadStock]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [save]);

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/stock/import', { method: 'POST', body: fd });
      const data = await res.json();
      setImportResult(res.ok ? data : { error: data.error || 'Import failed' });
      if (res.ok && store) await loadStock(store.posCode);
    } catch {
      setImportResult({ error: 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  /* Derived view data. Status counts reflect pending edits so the tiles stay truthful. */
  const withLive = useMemo(
    () =>
      rows.map(r => {
        const e = edits[r.productId];
        const qty = e?.qty !== undefined ? (e.qty === '' ? null : parseInt(e.qty)) : r.quantity;
        const thr = e?.thr !== undefined ? parseInt(e.thr) || 0 : r.lowStockThreshold;
        return { r, qty, thr, status: liveStatus(qty, thr) };
      }),
    [rows, edits]
  );
  const counts = useMemo(() => {
    const c: Record<Status, number> = { in_stock: 0, low: 0, out: 0, unknown: 0 };
    withLive.forEach(x => c[x.status]++);
    return c;
  }, [withLive]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(rows.map(r => r.category)))], [rows]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, typeof withLive>();
    for (const x of withLive) {
      if (category !== 'All' && x.r.category !== category) continue;
      if (statusFilter !== 'all' && x.status !== statusFilter) continue;
      if (q && !`${x.r.name} ${x.r.variant ?? ''} ${x.r.sku}`.toLowerCase().includes(q)) continue;
      map.set(x.r.category, [...(map.get(x.r.category) ?? []), x]);
    }
    return Array.from(map.entries());
  }, [withLive, query, category, statusFilter]);

  const focusNext = (id: string, kind: 'card' | 'list') => {
    const ids = grouped.flatMap(([, l]) => l.map(x => x.r.productId));
    const next = ids[ids.indexOf(id) + 1];
    if (next) qtyRefs.current[`${next}:${kind}`]?.focus();
  };

  const stepper = (r: Row, qtyStr: string, big: boolean) => (
    <div className="inline-flex items-center gap-1.5">
      <button
        onClick={() => bump(r, -1)}
        className={`${big ? 'w-11 h-11 rounded-2xl text-xl' : 'w-8 h-8 rounded-xl text-base'} bg-gray-100 dark:bg-zinc-800 font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-95 transition`}
        aria-label={`Decrease ${r.name}`}
      >
        −
      </button>
      <input
        ref={el => {
          qtyRefs.current[`${r.productId}:${big ? 'card' : 'list'}`] = el;
        }}
        type="number"
        inputMode="numeric"
        min={0}
        value={qtyStr}
        placeholder="–"
        onChange={ev => setEdit(r.productId, { qty: ev.target.value })}
        onFocus={ev => ev.target.select()}
        onKeyDown={ev => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            focusNext(r.productId, big ? 'card' : 'list');
          }
        }}
        className={`${input} ${big ? 'w-24 h-11 text-xl' : 'w-16 h-8 text-sm'} text-center font-extrabold`}
        aria-label={`Quantity for ${r.name} ${r.variant ?? ''}`}
      />
      <button
        onClick={() => bump(r, 1)}
        className={`${big ? 'w-11 h-11 rounded-2xl text-xl' : 'w-8 h-8 rounded-xl text-base'} bg-gray-100 dark:bg-zinc-800 font-bold hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-95 transition`}
        aria-label={`Increase ${r.name}`}
      >
        +
      </button>
    </div>
  );

  const lowAtInput = (r: Row, thrStr: string, small: boolean) => (
    <label className="flex items-center gap-1.5 shrink-0 text-gray-500 text-[11px]" title="Shows 'Low stock' at or below this number">
      Low at
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={thrStr}
        onChange={ev => setEdit(r.productId, { thr: ev.target.value })}
        className={`${input} ${small ? 'w-12 h-7 text-xs' : 'w-14 h-8 text-sm'} text-center`}
        aria-label={`Low stock threshold for ${r.name}`}
      />
    </label>
  );

  const tiles: { key: Status | 'all'; label: string; value: number; tone: string }[] = [
    { key: 'all', label: 'Products', value: rows.length, tone: 'text-gray-900 dark:text-white' },
    { key: 'in_stock', label: 'In stock', value: counts.in_stock, tone: STATUS_META.in_stock.text },
    { key: 'low', label: 'Low', value: counts.low, tone: STATUS_META.low.text },
    { key: 'out', label: 'Out', value: counts.out, tone: STATUS_META.out.text },
    { key: 'unknown', label: 'Not set', value: counts.unknown, tone: STATUS_META.unknown.text },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0c] pb-32">
      <header className="bg-white/90 dark:bg-[#0e0e11]/90 backdrop-blur border-b border-gray-200 dark:border-white/10 px-4 sm:px-6 py-3.5 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300" aria-label="Back to admin">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-extrabold text-gray-950 dark:text-white flex items-center gap-2 truncate">
              <Package className="w-5 h-5 text-blue-600 shrink-0" /> Stock management
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label="Home"
              title="Home"
              className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:text-blue-600"
            >
              <Home className="w-4 h-4" />
            </Link>
            <Link
              href="/admin/products"
              className="px-3 py-2 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            >
              Products
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Store picker + store summary */}
        <section className="bg-white dark:bg-[#16161a] rounded-3xl p-5 border border-gray-200/80 dark:border-white/10 space-y-4">
          <StorePicker stores={stores} value={store} onPick={pickStore} />

          {store && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {store.city}, {store.state} {store.pincode}
              </span>
              <span>·</span>
              <span>{store.status}</span>
            </div>
          )}

          {store && !loading && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {tiles.map(t => (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(t.key === statusFilter ? 'all' : t.key)}
                  aria-pressed={statusFilter === t.key}
                  className={`text-left rounded-2xl border px-4 py-3 transition ${
                    statusFilter === t.key
                      ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
                      : 'border-gray-100 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className={`text-2xl font-extrabold leading-none ${t.tone}`}>{t.value}</div>
                  <div className="text-[11px] font-semibold text-gray-500 mt-1">{t.label}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Empty state */}
        {!store && (
          <section className="bg-white dark:bg-[#16161a] rounded-3xl p-10 border border-dashed border-gray-300 dark:border-white/15 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
              <Package className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Pick a store to manage its stock</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Search by POS code, store name, city or PIN code above. You can also bulk-update many stores at once with a spreadsheet below. To add or disable products, use the Products page.
            </p>
          </section>
        )}

        {/* Stock / history */}
        {store && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex p-1 rounded-xl bg-gray-200/70 dark:bg-zinc-800">
                {(['stock', 'history'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition inline-flex items-center gap-1.5 ${
                      tab === t ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    {t === 'history' && <History className="w-3.5 h-3.5" />}
                    {t === 'stock' ? 'Stock' : 'History'}
                  </button>
                ))}
              </div>

              {tab === 'stock' && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <ViewToggle value={view} onChange={setView} />
                <div className="relative flex-1 sm:w-64 sm:flex-none">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Filter products"
                    aria-label="Filter products"
                    className={`${input} w-full pl-9 pr-3 py-2`}
                  />
                  </div>
                </div>
              )}
            </div>

            {tab === 'stock' && categories.length > 2 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
                {categories.map(c => (
                  <button key={c} onClick={() => setCategory(c)} className={chip(category === c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="space-y-2" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-[72px] rounded-2xl bg-white dark:bg-[#16161a] border border-gray-100 dark:border-white/10 animate-pulse" />
                ))}
              </div>
            )}

            {!loading && tab === 'stock' && grouped.length === 0 && (
              <div className="bg-white dark:bg-[#16161a] rounded-2xl p-8 text-center border border-gray-100 dark:border-white/10">
                <p className="text-sm text-gray-500">{rows.length === 0 ? 'No products in the catalogue yet.' : 'No products match your filters.'}</p>
                {rows.length > 0 && (
                  <button
                    onClick={() => {
                      setQuery('');
                      setCategory('All');
                      setStatusFilter('all');
                    }}
                    className="mt-2 text-sm font-semibold text-blue-600"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {!loading &&
              tab === 'stock' &&
              grouped.map(([cat, list]) => (
                <div key={cat}>
                  <h3 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2 px-1">
                    {cat} <span className="font-medium text-gray-400">· {list.length}</span>
                  </h3>

                  {view === 'list' ? (
                    <ul className="bg-white dark:bg-[#16161a] rounded-2xl border border-gray-200/80 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
                      {list.map(({ r, status }) => {
                        const e = edits[r.productId];
                        const qtyStr = e?.qty ?? (r.quantity === null ? '' : String(r.quantity));
                        const thrStr = e?.thr ?? String(r.lowStockThreshold);
                        const changed = dirtyIds.has(r.productId);
                        return (
                          <li
                            key={r.productId}
                            className={`px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${changed ? 'bg-blue-50/70 dark:bg-blue-950/20' : ''}`}
                          >
                            <CategoryIcon category={r.category} className="w-10 h-10 shrink-0" />
                            <div className="min-w-0 flex-1 basis-44">
                              <div className="text-sm font-bold text-gray-950 dark:text-white truncate">{r.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {r.variant ?? 'Standard'} · <span className="font-mono text-gray-400">{r.sku}</span>
                              </div>
                            </div>
                            <div className="hidden lg:block w-36 text-[11px] text-gray-400">
                              {changed && r.quantity !== null && e?.qty !== undefined ? (
                                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                  was {r.quantity} → {qtyStr || '–'}
                                </span>
                              ) : (
                                timeAgo(r.updatedAt)
                              )}
                            </div>
                            <div className="w-28 flex justify-start sm:justify-end">
                              <StatusPill status={status} label={status === 'unknown' ? 'Not set' : undefined} />
                            </div>
                            {stepper(r, qtyStr, false)}
                            {lowAtInput(r, thrStr, true)}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map(({ r, status }) => {
                        const e = edits[r.productId];
                        const qtyStr = e?.qty ?? (r.quantity === null ? '' : String(r.quantity));
                        const thrStr = e?.thr ?? String(r.lowStockThreshold);
                        const changed = dirtyIds.has(r.productId);
                        return (
                          <li
                            key={r.productId}
                            className={`rounded-3xl border bg-white dark:bg-[#16161a] overflow-hidden flex flex-col transition ${
                              changed ? 'border-blue-400 ring-2 ring-blue-500/15' : 'border-gray-200/80 dark:border-white/10'
                            }`}
                          >
                            <div className="p-4 flex items-start gap-3">
                              <CategoryIcon category={r.category} className="w-12 h-12 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-extrabold text-gray-950 dark:text-white leading-snug">{r.name}</div>
                                <div className="text-xs text-gray-500 truncate">{r.variant ?? 'Standard'}</div>
                                <div className="font-mono text-[10px] text-gray-400">{r.sku}</div>
                              </div>
                              <StatusPill status={status} label={status === 'unknown' ? 'Not set' : undefined} />
                            </div>

                            <div className="px-4 pb-4 flex items-center justify-center">{stepper(r, qtyStr, true)}</div>

                            <div className="mt-auto px-4 py-2.5 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-2 text-[11px] text-gray-400">
                              <span className="truncate">
                                {changed && r.quantity !== null && e?.qty !== undefined ? (
                                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                                    was {r.quantity} → {qtyStr || '–'}
                                  </span>
                                ) : (
                                  timeAgo(r.updatedAt)
                                )}
                              </span>
                              {lowAtInput(r, thrStr, true)}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ))}

            {!loading && tab === 'history' && (
              <div className="bg-white dark:bg-[#16161a] rounded-2xl border border-gray-100 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5 overflow-hidden">
                {history.length === 0 && <p className="p-8 text-sm text-gray-500 text-center">No stock movements recorded for this store yet.</p>}
                {history.map(m => (
                  <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {m.name}
                        {m.variant && <span className="font-normal text-gray-500"> · {m.variant}</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {m.reason}
                        {m.note ? ` — ${m.note}` : ''} · {new Date(m.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md ${
                          m.delta > 0
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : m.delta < 0
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'
                        }`}
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                      <div className="text-[11px] text-gray-400 mt-0.5">now {m.newQty}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Bulk import (collapsible) */}
        <section className="bg-white dark:bg-[#16161a] rounded-3xl border border-gray-200/80 dark:border-white/10 overflow-hidden">
          <button
            onClick={() => setImportOpen(o => !o)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
            aria-expanded={importOpen}
          >
            <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <Upload className="w-4 h-4 text-blue-600" /> Bulk stock import (XLSX / CSV)
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition ${importOpen ? 'rotate-180' : ''}`} />
          </button>

          {importOpen && (
            <div className="px-5 pb-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-500">Columns: POS Code, SKU, Quantity, Low Stock Threshold (optional). Works across any stores.</p>
                <a
                  href="/iPlanet_Stock_Import_Template.csv"
                  download
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl border border-blue-200/80 dark:border-blue-800/60 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Template
                </a>
              </div>

              <label
                onDragOver={e => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleImport(f);
                }}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-8 cursor-pointer text-center transition ${
                  dragging ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30' : 'border-gray-300 dark:border-white/15 hover:border-blue-400'
                }`}
              >
                {importing ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : <Upload className="w-6 h-6 text-gray-400" />}
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{importing ? 'Importing…' : 'Drop a file here, or click to browse'}</span>
                <span className="text-xs text-gray-500">.xlsx, .xls or .csv</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  disabled={importing}
                  className="sr-only"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleImport(f);
                    e.target.value = '';
                  }}
                />
              </label>

              {importResult?.error && <p className="text-sm text-red-600">{importResult.error}</p>}
              {importResult && !importResult.error && (
                <div className="rounded-2xl bg-gray-50 dark:bg-zinc-900 p-4 text-sm space-y-2">
                  <p className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                    <CheckCircle className="w-4 h-4" /> Imported {importResult.imported} of {importResult.totalRows} rows
                  </p>
                  {importResult.errors.length > 0 && (
                    <>
                      <p className="flex items-center gap-1.5 text-red-600 font-semibold">
                        <AlertTriangle className="w-4 h-4" /> {importResult.errors.length} row{importResult.errors.length === 1 ? '' : 's'} skipped
                      </p>
                      <ul className="text-xs text-red-600 space-y-0.5 max-h-40 overflow-y-auto">
                        {importResult.errors.map((er: any, i: number) => (
                          <li key={i}>
                            Row {er.row}: {er.error}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Sticky save bar */}
      {store && dirty.length > 0 && tab === 'stock' && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#0e0e11]/95 backdrop-blur animate-fadeInUp">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
            <div className="text-sm font-bold text-gray-900 dark:text-white mr-auto">
              {dirty.length} unsaved change{dirty.length === 1 ? '' : 's'}
              <span className="hidden sm:inline text-xs font-normal text-gray-500"> · Ctrl+S to save</span>
            </div>
            <select value={reason} onChange={e => setReason(e.target.value)} className={`${input} px-3 py-2`} aria-label="Reason for change">
              {REASONS.map(r => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className={`${input} px-3 py-2 flex-1 min-w-[140px] sm:max-w-xs`} />
            <button
              onClick={() => setEdits({})}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-zinc-800"
            >
              <Undo2 className="w-4 h-4" /> Discard
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed top-20 right-4 z-50 max-w-sm flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl animate-fadeInUp ${
            toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'ok' ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss">
            <X className="w-4 h-4 opacity-80" />
          </button>
        </div>
      )}
    </div>
  );
}
