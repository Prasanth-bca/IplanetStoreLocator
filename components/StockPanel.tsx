'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Package, Search, X } from 'lucide-react';
import { Status, StatusPill, timeAgo } from '@/components/stockUi';

interface StockItem {
  sku: string;
  name: string;
  category: string;
  variant: string | null;
  quantity: number | null;
  status: Status;
  updatedAt: string | null;
}

interface StockPanelProps {
  posCode: string;
  onClose: () => void;
}

const chip = (active: boolean) =>
  `shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
    active
      ? 'bg-blue-600 border-blue-600 text-white'
      : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:border-blue-400'
  }`;

const QTY_TONE: Record<Status, string> = {
  in_stock: 'text-emerald-600 dark:text-emerald-400',
  low: 'text-amber-600 dark:text-amber-400',
  out: 'text-red-600 dark:text-red-400',
  unknown: 'text-gray-400',
};

/** Stock list shown inline inside a store card: one row per product with its available quantity. */
export const StockPanel: React.FC<StockPanelProps> = ({ posCode, onClose }) => {
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

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.category)))], [items]);
  const availableCount = items.filter(i => i.status === 'in_stock' || i.status === 'low').length;
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

  return (
    <section
      className="mt-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-zinc-900/40 overflow-hidden animate-fadeIn"
      aria-label={`Stock available at ${posCode}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#16161a]">
        <div className="flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <h4 className="text-sm font-extrabold text-gray-950 dark:text-white">Stock available</h4>
          {!loading && !error && items.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {availableCount} of {items.length} products
            </span>
          )}
        </div>
        <button onClick={onClose} aria-label="Hide stock" className="p-1.5 -mr-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      {!loading && !error && items.length > 0 && (
        <div className="px-4 pt-3 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search a product, e.g. iPhone 16"
              aria-label="Search products"
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
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
      )}

      {/* List */}
      <div className="px-4 py-3 max-h-[380px] overflow-y-auto">
        {loading && (
          <div className="space-y-3" aria-busy="true" aria-label="Loading stock">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3 animate-pulse">
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-2/3 rounded bg-gray-200 dark:bg-zinc-800" />
                  <div className="h-2.5 w-1/3 rounded bg-gray-100 dark:bg-zinc-800/70" />
                </div>
                <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-6">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button onClick={() => setReloadKey(k => k + 1)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">Stock details haven&apos;t been set up yet. Please call the store.</p>
        )}

        {!loading && !error && items.length > 0 && grouped.length === 0 && (
          <div className="text-center py-6">
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

        {!loading && !error && grouped.length > 0 && (
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#16161a] overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_48px] sm:grid-cols-[minmax(0,1fr)_72px_120px] gap-3 px-3 py-2 text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-white/10">
              <span>Product</span>
              <span className="text-right">Qty</span>
              <span className="hidden sm:block text-right">Status</span>
            </div>
            {grouped.map(([cat, list]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 bg-gray-50/70 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-white/5">
                  {cat}
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-white/5">
                  {list.map(it => (
                    <li key={it.sku} className="grid grid-cols-[minmax(0,1fr)_48px] sm:grid-cols-[minmax(0,1fr)_72px_120px] gap-3 items-center px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white sm:truncate">{it.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 sm:truncate">{it.variant ?? 'Standard'}</div>
                        {/* On phones the status sits under the name so the name keeps its width */}
                        <div className="sm:hidden mt-1.5">
                          <StatusPill status={it.status} label={it.status === 'unknown' ? 'Call store' : undefined} />
                        </div>
                      </div>
                      <div className={`text-right text-base font-extrabold tabular-nums ${QTY_TONE[it.status]}`}>{it.quantity ?? '–'}</div>
                      <div className="hidden sm:flex justify-end">
                        <StatusPill status={it.status} label={it.status === 'unknown' ? 'Call store' : undefined} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && !error && items.length > 0 && (
        <p className="px-4 pb-3 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
          {lastUpdated ? `Last updated ${timeAgo(lastUpdated).replace('Updated ', '')}. ` : ''}
          Quantities change through the day, so call the store to confirm before you visit.
        </p>
      )}
    </section>
  );
};
