'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export interface StoreLite {
  id: string;
  posCode: string;
  storeName: string;
  city: string;
  pincode: string;
}

const input =
  'rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40';

/** Searchable store dropdown: type a POS code, name, city or PIN. */
export function StorePicker<T extends StoreLite>({ stores, value, onPick }: { stores: T[]; value: T | null; onPick: (s: T) => void }) {
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
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1740] shadow-xl overflow-hidden">
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
