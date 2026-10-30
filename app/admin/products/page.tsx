'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Home,
  CheckCircle,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CategoryIcon } from '@/components/stockUi';
import { ViewToggle, useViewMode } from '@/components/ViewToggle';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  variant: string | null;
  active: boolean;
  totalUnits: number;
  storesInStock: number;
}

interface FormState {
  sku: string;
  name: string;
  category: string;
  variant: string;
  active: boolean;
}

const EMPTY: FormState = { sku: '', name: '', category: '', variant: '', active: true };

const input =
  'rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40';

const chip = (active: boolean) =>
  `shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
    active
      ? 'bg-blue-600 border-blue-600 text-white'
      : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:border-blue-400'
  }`;

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-700'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [view, setView] = useViewMode('admin-products-view');

  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products');
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      setToast({ type: 'err', text: 'Could not load products.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.type === 'ok' ? 3500 : 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category))).sort(), [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(p => {
      if (category !== 'All' && p.category !== category) return false;
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'disabled' && p.active) return false;
      if (q && !`${p.name} ${p.variant ?? ''} ${p.sku} ${p.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, category, statusFilter]);

  const activeCount = products.filter(p => p.active).length;

  const openNew = () => {
    setForm({ ...EMPTY, category: category !== 'All' ? category : '' });
    setFormError(null);
    setEditing('new');
  };

  const openEdit = (p: Product) => {
    setForm({ sku: p.sku, name: p.name, category: p.category, variant: p.variant ?? '', active: p.active });
    setFormError(null);
    setEditing(p);
  };

  const closeForm = useCallback(() => !saving && setEditing(null), [saving]);

  useEffect(() => {
    if (!editing && !deleting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleting) setDeleting(null);
      else closeForm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing, deleting, closeForm]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.sku.trim() || !form.name.trim() || !form.category.trim()) {
      setFormError('SKU, name and category are required.');
      return;
    }
    setSaving(true);
    try {
      const isNew = editing === 'new';
      const res = await fetch(isNew ? '/api/admin/products' : `/api/admin/products/${(editing as Product).id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, variant: form.variant.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setToast({ type: 'ok', text: isNew ? `Added ${form.name.trim()}.` : `Saved changes to ${form.name.trim()}.` });
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product, active: boolean) => {
    setBusyId(p.id);
    // Optimistic: flip the card immediately, roll back if the server refuses.
    setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active } : x)));
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Update failed');
      setToast({ type: 'ok', text: `${p.name} ${active ? 'enabled' : 'disabled'}.` });
    } catch (err) {
      setProducts(prev => prev.map(x => (x.id === p.id ? { ...x, active: p.active } : x)));
      setToast({ type: 'err', text: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const res = await fetch(`/api/admin/products/${deleting.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setToast({ type: 'ok', text: `Deleted ${deleting.name}.` });
      setDeleting(null);
      await load();
    } catch (err) {
      setToast({ type: 'err', text: err instanceof Error ? err.message : 'Delete failed' });
      setDeleting(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-pal-page-dark pb-16">
      <header className="bg-white/90 dark:bg-pal-bar-dark/90 backdrop-blur border-b border-gray-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 2xl:px-12 py-3.5 sticky top-0 z-40">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300" aria-label="Back to admin">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-extrabold text-gray-950 dark:text-white flex items-center gap-2 truncate">
              <Package className="w-5 h-5 text-blue-600 shrink-0" /> Products
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
              href="/admin/stock"
              className="hidden sm:inline-flex px-3 py-2 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            >
              Manage stock
            </Link>
            <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
              <Plus className="w-4 h-4" /> Add product
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 py-6 space-y-5">
        {/* Filters */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, SKU or variant"
                aria-label="Search products"
                className={`${input} w-full pl-10 pr-3 py-2.5`}
              />
            </div>
            <div className="inline-flex p-1 rounded-xl bg-gray-200/70 dark:bg-zinc-800">
              {(['all', 'active', 'disabled'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${
                    statusFilter === s ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {s}
                  {s === 'all' && <span className="ml-1 text-gray-400">{products.length}</span>}
                  {s === 'active' && <span className="ml-1 text-gray-400">{activeCount}</span>}
                  {s === 'disabled' && <span className="ml-1 text-gray-400">{products.length - activeCount}</span>}
                </button>
              ))}
            </div>
            <div className="ml-auto">
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {['All', ...categories].map(c => (
                <button key={c} onClick={() => setCategory(c)} className={chip(category === c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </section>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-3xl bg-white dark:bg-pal-card-dark border border-gray-100 dark:border-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="bg-white dark:bg-pal-card-dark rounded-3xl p-10 border border-dashed border-gray-300 dark:border-white/15 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {products.length === 0 ? 'No products yet' : 'No products match your filters'}
            </p>
            <div className="mt-3 flex items-center justify-center gap-3">
              {products.length === 0 ? (
                <button onClick={openNew} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">
                  Add your first product
                </button>
              ) : (
                <button
                  onClick={() => {
                    setQuery('');
                    setCategory('All');
                    setStatusFilter('all');
                  }}
                  className="text-sm font-semibold text-blue-600"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Products: list (default) or cards */}
        {!loading && visible.length > 0 && view === 'list' && (
          <div className="bg-white dark:bg-pal-card-dark rounded-3xl border border-gray-200/80 dark:border-white/10 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_90px_90px_130px_96px] gap-4 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100 dark:border-white/10">
              <span>Product</span>
              <span>SKU</span>
              <span className="text-right">Units</span>
              <span className="text-right">Stores</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {visible.map(p => (
                <li
                  key={p.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_90px_90px_130px_96px] items-center gap-x-4 gap-y-2 px-5 py-3 hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
                >
                  <div className={`flex items-center gap-3 min-w-0 ${p.active ? '' : 'opacity-55'}`}>
                    <CategoryIcon category={p.category} className="w-10 h-10 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-950 dark:text-white truncate">{p.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {p.category} · {p.variant ?? 'Standard'}
                      </div>
                    </div>
                  </div>
                  <span className={`hidden md:block font-mono text-xs text-gray-500 truncate ${p.active ? '' : 'opacity-55'}`}>{p.sku}</span>
                  <span className={`hidden md:block text-right text-sm font-bold text-gray-900 dark:text-white ${p.active ? '' : 'opacity-55'}`}>{p.totalUnits}</span>
                  <span className={`hidden md:block text-right text-sm font-bold text-gray-900 dark:text-white ${p.active ? '' : 'opacity-55'}`}>{p.storesInStock}</span>
                  <label className="hidden md:flex items-center gap-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    <Toggle on={p.active} onChange={v => toggleActive(p, v)} label={`${p.active ? 'Disable' : 'Enable'} ${p.name}`} disabled={busyId === p.id} />
                    {p.active ? 'Enabled' : 'Disabled'}
                  </label>
                  <div className="flex items-center justify-end gap-1">
                    <span className="md:hidden mr-1">
                      <Toggle on={p.active} onChange={v => toggleActive(p, v)} label={`${p.active ? 'Disable' : 'Enable'} ${p.name}`} disabled={busyId === p.id} />
                    </span>
                    <button onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`} className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`} className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className={`md:hidden col-span-2 text-[11px] text-gray-500 flex flex-wrap gap-x-3 ${p.active ? '' : 'opacity-55'}`}>
                    <span className="font-mono">{p.sku}</span>
                    <span>{p.totalUnits} units</span>
                    <span>{p.storesInStock} stores</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && visible.length > 0 && view === 'card' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(p => (
              <article
                key={p.id}
                className={`rounded-3xl border bg-white dark:bg-pal-card-dark overflow-hidden transition hover:shadow-lg ${
                  p.active ? 'border-gray-200/80 dark:border-white/10' : 'border-dashed border-gray-300 dark:border-white/15'
                }`}
              >
                <div className={`p-5 flex items-start gap-4 ${p.active ? '' : 'opacity-55'}`}>
                  <CategoryIcon category={p.category} className="w-16 h-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{p.category}</div>
                    <h3 className="text-base font-extrabold text-gray-950 dark:text-white leading-snug">{p.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{p.variant ?? 'Standard'}</p>
                    <p className="mt-1 font-mono text-[11px] text-gray-400">{p.sku}</p>
                  </div>
                </div>

                <div className={`grid grid-cols-2 gap-px bg-gray-100 dark:bg-white/5 border-y border-gray-100 dark:border-white/5 ${p.active ? '' : 'opacity-55'}`}>
                  <div className="bg-white dark:bg-pal-card-dark px-5 py-3">
                    <div className="text-xl font-extrabold text-gray-900 dark:text-white leading-none">{p.totalUnits}</div>
                    <div className="text-[11px] font-semibold text-gray-500 mt-1">Units across stores</div>
                  </div>
                  <div className="bg-white dark:bg-pal-card-dark px-5 py-3">
                    <div className="text-xl font-extrabold text-gray-900 dark:text-white leading-none">{p.storesInStock}</div>
                    <div className="text-[11px] font-semibold text-gray-500 mt-1">Stores stocking</div>
                  </div>
                </div>

                <div className="px-5 py-3 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    <Toggle on={p.active} onChange={v => toggleActive(p, v)} label={`${p.active ? 'Disable' : 'Enable'} ${p.name}`} disabled={busyId === p.id} />
                    {p.active ? 'Enabled' : 'Disabled'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleting(p)}
                      aria-label={`Delete ${p.name}`}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Add / edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] sm:p-4 animate-fadeIn" onClick={closeForm} role="dialog" aria-modal="true">
          <form
            onSubmit={submit}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-pal-card-dark w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl animate-fadeInUp"
          >
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="text-base font-extrabold text-gray-950 dark:text-white">{editing === 'new' ? 'Add product' : 'Edit product'}</h2>
              <button type="button" onClick={closeForm} aria-label="Close" className="p-2 -mr-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Product name</span>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. iPhone 16 Pro"
                  maxLength={120}
                  className={`${input} w-full mt-1 px-3.5 py-2.5`}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Category</span>
                  <input
                    list="product-categories"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="iPhone, Mac…"
                    maxLength={40}
                    className={`${input} w-full mt-1 px-3.5 py-2.5`}
                  />
                  <datalist id="product-categories">
                    {categories.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Variant <span className="font-normal text-gray-400">(optional)</span></span>
                  <input
                    value={form.variant}
                    onChange={e => setForm(f => ({ ...f, variant: e.target.value }))}
                    placeholder="256GB Black"
                    maxLength={80}
                    className={`${input} w-full mt-1 px-3.5 py-2.5`}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">SKU</span>
                <input
                  value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="Unique code, e.g. IP-16P-256-NAT"
                  maxLength={60}
                  className={`${input} w-full mt-1 px-3.5 py-2.5 font-mono`}
                />
                {editing !== 'new' && <span className="text-[11px] text-gray-400">Changing the SKU also changes the code used in stock import files.</span>}
              </label>
              <label className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 dark:bg-zinc-900 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white">Enabled</span>
                  <span className="block text-xs text-gray-500">Disabled products are hidden from customers and the stock screen.</span>
                </span>
                <Toggle on={form.active} onChange={v => setForm(f => ({ ...f, active: v }))} label="Enabled" />
              </label>
              {formError && (
                <p className="text-sm text-red-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {formError}
                </p>
              )}
            </div>

            <div className="px-5 pb-5 flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing === 'new' ? 'Add product' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-fadeIn" onClick={() => setDeleting(null)} role="alertdialog" aria-modal="true">
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-pal-card-dark w-full max-w-sm rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl p-6 animate-fadeInUp">
            <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-base font-extrabold text-gray-950 dark:text-white">Delete {deleting.name}?</h2>
            <p className="text-sm text-gray-500 mt-1">
              This permanently removes the product{deleting.variant ? ` (${deleting.variant})` : ''} and its stock records. If it has stock history you&apos;ll be asked to disable it instead.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={busyId === deleting.id} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50">
                {busyId === deleting.id && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={`fixed top-20 right-4 z-[60] max-w-sm flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl animate-fadeInUp ${
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
