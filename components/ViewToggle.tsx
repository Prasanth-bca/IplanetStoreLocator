'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';

export type ViewMode = 'list' | 'card';

/** List by default; the last choice is remembered per page, and storage failures fall back silently. */
export function useViewMode(storageKey: string): [ViewMode, (v: ViewMode) => void] {
  const [view, setViewState] = useState<ViewMode>('list');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === 'list' || saved === 'card') setViewState(saved);
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  const setView = useCallback(
    (v: ViewMode) => {
      setViewState(v);
      try {
        window.localStorage.setItem(storageKey, v);
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey]
  );

  return [view, setView];
}

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { key: ViewMode; label: string; Icon: typeof List }[] = [
    { key: 'list', label: 'List', Icon: List },
    { key: 'card', label: 'Cards', Icon: LayoutGrid },
  ];
  return (
    <div className="inline-flex p-1 rounded-xl bg-gray-200/70 dark:bg-zinc-800" role="group" aria-label="View mode">
      {opts.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          title={`${label} view`}
          aria-label={`${label} view`}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
            value === key ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
