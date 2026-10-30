'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { SelectedDevice, useOffers } from '@/components/offers/OffersContext';

interface ProductLite {
  sku: string;
  name: string;
  variant: string | null;
  category: string;
}

// The catalogue is a few hundred rows, so fetch it once per page load and search it in the browser.
let productsPromise: Promise<ProductLite[]> | null = null;
function loadProducts(): Promise<ProductLite[]> {
  productsPromise ??= fetch('/api/products')
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load products');
      return (body.products as ProductLite[]).map((p) => ({ sku: p.sku, name: p.name, variant: p.variant, category: p.category }));
    })
    .catch((e) => {
      productsPromise = null; // allow a retry next time
      throw e;
    });
  return productsPromise;
}

const DEVICE_RANK: Record<string, number> = { iPhone: 0, iPad: 1, Mac: 2, Watch: 3, AirPods: 4 };

export const deviceLabel = (p: { name: string; variant: string | null }): string =>
  p.variant && !p.name.toLowerCase().includes(p.variant.toLowerCase()) ? `${p.name} · ${p.variant}` : p.name;

/** The single device search that drives both offer panels. */
export function DeviceSearch() {
  const { device, selectDevice } = useOffers();
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  // The list floats above the page (a portal), so the panel's edges and scrolling can never clip it.
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const listId = 'device-search-list';

  useEffect(() => {
    loadProducts().then(setProducts).catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return products
      .filter((p) => {
        const hay = `${p.name} ${p.variant ?? ''} ${p.category} ${p.sku}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => (DEVICE_RANK[a.category] ?? 9) - (DEVICE_RANK[b.category] ?? 9) || a.name.localeCompare(b.name));
  }, [products, query]);

  const shown = results;

  const place = () => {
    const r = field.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 16;
    const above = r.top - 16;
    // Prefer opening downward; open upward only when there is clearly more room above.
    const up = below < 240 && above > below;
    const maxHeight = Math.max(180, Math.min(up ? above : below, 640));
    const width = Math.min(Math.max(r.width, 440), window.innerWidth - 16);
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width, maxHeight, top: up ? r.top - 6 - Math.min(maxHeight, 640) : r.bottom + 6 });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, query]);

  useEffect(() => {
    document.getElementById(`device-opt-${shown[active]?.sku}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, shown]);

  const choose = (p: ProductLite) => {
    const d: SelectedDevice = { sku: p.sku, name: p.name, variant: p.variant, category: p.category };
    selectDevice(d);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && shown[active]) {
      e.preventDefault();
      choose(shown[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={box} className="relative">
      <div ref={field} className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          role="combobox"
          aria-expanded={open && shown.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && shown[active] ? `device-opt-${shown[active].sku}` : undefined}
          aria-label="Search a device for offers"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search a device, e.g. iPhone 17 Pro 256GB"
          autoComplete="off"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </div>

      {open && query.trim() && pos && typeof document !== 'undefined' && createPortal(
        <ul
          ref={list}
          id={listId}
          role="listbox"
          style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-[100] overflow-y-auto rounded-2xl border border-gray-200 bg-white py-1 shadow-2xl dark:border-white/10 dark:bg-[#1A1740]"
        >
          {loadError && <li className="px-4 py-3 text-sm text-red-600">The device list couldn’t be loaded.</li>}
          {!loadError && shown.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">No device matches “{query}”.</li>}
          {shown.map((p, i) => (
            <li
              key={p.sku}
              id={`device-opt-${p.sku}`}
              role="option"
              aria-selected={device?.sku === p.sku}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 ${i === active ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
            >
              <span className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white">{deviceLabel(p)}</span>
              <span className="shrink-0 text-[11px] font-semibold text-gray-400">{p.category}</span>
            </li>
          ))}
          {shown.length > 0 && <li className="border-t border-gray-100 px-4 py-1.5 text-[11px] text-gray-400 dark:border-white/10">{shown.length} matching {shown.length === 1 ? 'device' : 'devices'}</li>}
        </ul>,
        document.body
      )}

      {device && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-gray-100/80 px-3 py-2 dark:bg-zinc-800/70">
          <span className="min-w-0 text-xs text-gray-500 dark:text-gray-400">
            Showing offers for <strong className="font-bold text-gray-900 dark:text-white">{deviceLabel(device)}</strong>
          </span>
          <button type="button" onClick={() => selectDevice(null)} aria-label="Clear selected device" className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-zinc-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
