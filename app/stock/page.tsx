'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Home, Loader2, Package } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StorePicker, StoreLite } from '@/components/StorePicker';
import { StockPanel } from '@/components/StockPanel';

/** Read-only stock viewer: pick a store and see what it has. Updating stock is an Admin task. */
export default function StockViewerPage() {
  const [stores, setStores] = useState<StoreLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<StoreLite | null>(null);

  useEffect(() => {
    fetch('/api/stores/list')
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load stores');
        setStores(data.stores);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load stores'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b171c] pb-16">
      <header className="bg-white/90 dark:bg-[#0f1e25]/90 backdrop-blur border-b border-gray-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 2xl:px-12 py-3.5 sticky top-0 z-40">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300" aria-label="Back to home">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-extrabold text-gray-950 dark:text-white flex items-center gap-2 truncate">
              <Package className="w-5 h-5 text-emerald-600 shrink-0" /> Stock
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
        <section className="bg-white dark:bg-[#142830] rounded-3xl p-5 border border-gray-200/80 dark:border-white/10 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Choose a store to see its stock.</p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading stores…
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <StorePicker stores={stores} value={store} onPick={setStore} />
          )}
        </section>

        {!store && !loading && !error && (
          <div className="bg-white dark:bg-[#142830] rounded-3xl p-10 border border-dashed border-gray-300 dark:border-white/15 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <Package className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">No store selected</p>
            <p className="text-xs text-gray-500 mt-1">Search by POS code, store name, city or PIN code above.</p>
          </div>
        )}

        {store && <StockPanel key={store.posCode} posCode={store.posCode} storeName={store.storeName} tall />}
      </main>
    </div>
  );
}
