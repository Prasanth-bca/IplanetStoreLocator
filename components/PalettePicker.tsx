'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { DEFAULT_PALETTE, PALETTES, PALETTE_KEY } from '@/lib/palettes';

function apply(id: string) {
  document.documentElement.setAttribute('data-palette', id);
  try {
    localStorage.setItem(PALETTE_KEY, id);
  } catch {
    /* private mode: the choice just lasts until the page is closed */
  }
}

/** Admin theme menu: choose the colour palette. Saved in this browser. */
export function PalettePicker() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(DEFAULT_PALETTE);
  const [alignRight, setAlignRight] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(document.documentElement.getAttribute('data-palette') || DEFAULT_PALETTE);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const choose = (id: string) => {
    apply(id);
    setCurrent(id);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => {
          // open toward whichever side has room, so the menu never leaves the screen
          const r = box.current?.getBoundingClientRect();
          if (r) setAlignRight(r.left + 288 > window.innerWidth - 8);
          setOpen((o) => !o);
        }}
        aria-label="Colour theme"
        title="Colour theme"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-800/90 hover:bg-blue-50 dark:hover:bg-zinc-700 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl border border-gray-200/80 dark:border-zinc-700 transition"
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden 2xl:inline">Theme</span>
      </button>

      {open && (
        <div role="menu" aria-label="Colour theme" className={`absolute ${alignRight ? 'right-0' : 'left-0'} z-[60] mt-2 w-72 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-pal-card-dark/95 p-2 shadow-2xl backdrop-blur-xl`}>
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Colour theme</p>
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={current === p.id}
              onClick={() => choose(p.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${current === p.id ? 'bg-blue-50 dark:bg-blue-950/50' : 'hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
            >
              <span className="flex shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10 dark:ring-white/15" aria-hidden>
                {p.swatches.map((c) => (
                  <span key={c} className="h-8 w-4" style={{ background: c }} />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-gray-900 dark:text-white">{p.name}</span>
                <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">{p.note}</span>
              </span>
              {current === p.id && <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />}
            </button>
          ))}
          <p className="px-3 pb-2 pt-1.5 text-[11px] text-gray-400">Saved in this browser. Light and dark mode work with every theme.</p>
        </div>
      )}
    </div>
  );
}
