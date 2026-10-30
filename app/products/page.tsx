'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Home, Package, Search, Tag } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CategoryIcon } from '@/components/stockUi';
import { ViewToggle, useViewMode } from '@/components/ViewToggle';

interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  variant: string | null;
  totalUnits: number;
  storesInStock: number;
}

const input =
  'rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40';

const chip = (active: boolean) =>
  `shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
    active
      ? 'bg-blue-600 border-blue-600 text-white'
      : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:border-blue-400'
  }`;

/** Read-only product catalogue. Adding, editing and disabling products is an Admin task. */
export default function ProductViewerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [view, setView] = useViewMode('products-viewer-view');

  useEffect(() => {
    fetch('/api/products')
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load products');
        setProducts(data.products);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load products'))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category))).sort(), [products]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(p => {
      if (category !== 'All' && p.category !== category) return false;
      return !q || `${p.name} ${p.variant ?? ''} ${p.sku} ${p.category}`.toLowerCase().includes(q);
    });
  }, [products, query, category]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0b26] pb-16">
      <header className="bg-white/90 dark:bg-[#121030]/90 backdrop-blur border-b border-gray-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 2xl:px-12 py-3.5 sticky top-0 z-40">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300" aria-label="Back to home">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-extrabold text-gray-950 dark:text-white flex items-center gap-2 truncate">
              <Tag className="w-5 h-5 text-violet-600 shrink-0" /> Products
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
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, SKU or variant" aria-label="Search products" className={`${input} w-full pl-10 pr-3 py-2.5`} />
            </div>
            <span className="text-xs font-semibold text-gray-500">{loading ? '' : `${visible.length} of ${products.length} products`}</span>
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
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-white dark:bg-[#1A1740] border border-gray-100 dark:border-white/10 animate-pulse" />
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && visible.length === 0 && (
          <div className="bg-white dark:bg-[#1A1740] rounded-3xl p-10 border border-dashed border-gray-300 dark:border-white/15 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
              <Package className="w-6 h-6 text-violet-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{products.length === 0 ? 'No products yet' : 'No products match your search'}</p>
          </div>
        )}

        {!loading && !error && visible.length > 0 && view === 'list' && (
          <div className="bg-white dark:bg-[#1A1740] rounded-3xl border border-gray-200/80 dark:border-white/10 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_100px_100px] gap-4 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100 dark:border-white/10">
              <span>Product</span>
              <span>SKU</span>
              <span className="text-right">Units</span>
              <span className="text-right">Stores</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {visible.map(p => (
                <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_100px_100px] items-center gap-x-4 gap-y-1 px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon category={p.category} className="w-10 h-10 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-950 dark:text-white truncate">{p.name}</div>
                      <div className="text-xs text-gray-500 truncate">{p.category} · {p.variant ?? 'Standard'}</div>
                    </div>
                  </div>
                  <span className="hidden md:block font-mono text-xs text-gray-500 truncate">{p.sku}</span>
                  <span className="hidden md:block text-right text-sm font-bold text-gray-900 dark:text-white">{p.totalUnits}</span>
                  <span className="hidden md:block text-right text-sm font-bold text-gray-900 dark:text-white">{p.storesInStock}</span>
                  <div className="md:hidden text-right text-xs text-gray-500">
                    <div className="font-bold text-gray-900 dark:text-white">{p.totalUnits} units</div>
                    <div>{p.storesInStock} stores</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!loading && !error && visible.length > 0 && view === 'card' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(p => (
              <article key={p.id} className="rounded-3xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#1A1740] overflow-hidden">
                <div className="p-5 flex items-start gap-4">
                  <CategoryIcon category={p.category} className="w-16 h-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{p.category}</div>
                    <h3 className="text-base font-extrabold text-gray-950 dark:text-white leading-snug">{p.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{p.variant ?? 'Standard'}</p>
                    <p className="mt-1 font-mono text-[11px] text-gray-400">{p.sku}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
                  <div className="bg-white dark:bg-[#1A1740] px-5 py-3">
                    <div className="text-xl font-extrabold text-gray-900 dark:text-white leading-none">{p.totalUnits}</div>
                    <div className="text-[11px] font-semibold text-gray-500 mt-1">Units across stores</div>
                  </div>
                  <div className="bg-white dark:bg-[#1A1740] px-5 py-3">
                    <div className="text-xl font-extrabold text-gray-900 dark:text-white leading-none">{p.storesInStock}</div>
                    <div className="text-[11px] font-semibold text-gray-500 mt-1">Stores stocking</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
