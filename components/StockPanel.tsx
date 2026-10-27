'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Package, Phone, Search, X } from 'lucide-react';
import { Status, StatusPill, timeAgo } from '@/components/stockUi';

interface StockItem {
  sku: string;
  name: string;
  category: string;
  variant: string | null;
  status: Status;
  updatedAt: string | null;
}

interface StockPanelProps {
  posCode: string;
  storeName: string;
  phone?: string | null;
  onClose: () => void;
}

const chip = (active: boolean) =>
  `shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
    active
      ? 'bg-blue-600 border-blue-600 text-white'
      : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:border-blue-400'
  }`;

export const StockPanel: React.FC<StockPanelProps> = ({ posCode, storeName, phone, onClose }) => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/stores/${encodeURIComponent(posCode)}/stock`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load stock');
        if (!cancelled) setItems(data.items);
      })
      .catch(e => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load stock'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [posCode, reloadKey]);

  // Close on Escape and stop the page behind the sheet from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.category)))], [items]);
  const available = items.filter(i => i.status === 'in_stock' || i.status === 'low').length;
  const lastUpdated = items.reduce<string | null>((a, i) => (i.updatedAt && (!a || i.updatedAt > a) ? i.updatedAt : a), null);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, StockItem[]>();
    for (const it of items) {
      if (category !== 'All' && it.category !== category) continue;
      if (availableOnly && it.status !== 'in_stock' && it.status !== 'low') continue;
      if (q && !`${it.name} ${it.variant ?? ''}`.toLowerCase().includes(q)) continue;
      map.set(it.category, [...(map.get(it.category) ?? []), it]);
    }
    return Array.from(map.entries());
  }, [items, query, category, availableOnly]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;

  // Portal to <body>: the store card's entrance animation creates a containing block that would trap `fixed`.
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] sm:p-4 animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Stock availability at ${storeName}`}
    >
      <div
        className="bg-white dark:bg-[#16161a] w-full sm:max-w-xl h-[88vh] sm:h-auto sm:max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl animate-fadeInUp"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-3 sm:pt-5 pb-4 border-b border-gray-100 dark:border-white/10">
          <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 dark:bg-zinc-700" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <Package className="w-3.5 h-3.5" /> Stock availability
              </div>
              <h3 className="text-lg font-extrabold text-gray-950 dark:text-white leading-snug truncate">{storeName}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                POS <span className="font-mono font-semibold">{posCode}</span>
                {!loading && !error && items.length > 0 && (
                  <>
                    {' '}· <span className="font-semibold text-gray-700 dark:text-gray-200">{available} of {items.length}</span> products available
                  </>
                )}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2 -mr-1 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search a product, e.g. iPhone 16"
              aria-label="Search products"
              className="w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-0.5 -mx-1 px-1">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} className={chip(category === c)}>
                {c}
              </button>
            ))}
            <span className="w-px h-5 bg-gray-200 dark:bg-zinc-700 shrink-0" />
            <button onClick={() => setAvailableOnly(v => !v)} className={chip(availableOnly)} aria-pressed={availableOnly}>
              Available only
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && (
            <div className="space-y-3" aria-busy="true" aria-label="Loading stock">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3 animate-pulse">
                  <div className="space-y-2 flex-1">
                    <div className="h-3.5 w-2/3 rounded bg-gray-200 dark:bg-zinc-800" />
                    <div className="h-2.5 w-1/3 rounded bg-gray-100 dark:bg-zinc-800/70" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-10">
              <p className="text-sm text-red-600 mb-3">{error}</p>
              <button onClick={() => setReloadKey(k => k + 1)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">
                Try again
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-10">Stock details haven&apos;t been set up yet. Please call the store.</p>
          )}

          {!loading && !error && items.length > 0 && grouped.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500 mb-2">No products match your filters.</p>
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('All');
                  setAvailableOnly(false);
                }}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400"
              >
                Clear filters
              </button>
            </div>
          )}

          {grouped.map(([cat, list]) => (
            <section key={cat}>
              <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-2">
                {cat} <span className="text-gray-400 font-medium">· {list.length}</span>
              </h4>
              <ul className="divide-y divide-gray-100 dark:divide-white/5 rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
                {list.map(it => (
                  <li key={it.sku} className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-[#16161a]">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{it.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {it.variant ?? 'Standard'} · {timeAgo(it.updatedAt)}
                      </div>
                    </div>
                    <StatusPill status={it.status} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
            {lastUpdated ? `Last store update: ${timeAgo(lastUpdated).replace('Updated ', '')}. ` : ''}
            Stock changes through the day, so call to confirm before you visit.
          </p>
          {telHref && (
            <a
              href={telHref}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold no-underline"
              style={{ textDecoration: 'none' }}
            >
              <Phone className="w-3.5 h-3.5" /> Call store
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
