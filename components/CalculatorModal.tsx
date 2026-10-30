'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Delete, X } from 'lucide-react';

type Op = '+' | '-' | '×' | '÷';

/** 0.1 + 0.2 should read 0.3, not 0.30000000000000004. */
const tidy = (n: number): string => (Number.isFinite(n) ? String(parseFloat(n.toPrecision(12))) : 'Error');

function apply(a: number, op: Op, b: number): number {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '×') return a * b;
  return b === 0 ? NaN : a / b;
}

/** A basic four-function calculator in a popup. No eval; just a small state machine. */
export function CalculatorModal({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true); // next digit starts a new number
  const [trail, setTrail] = useState('');
  // Set when % has turned the typed number into its percentage value, e.g. "10%" of 200 -> 20.
  const [pct, setPct] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const digit = useCallback((d: string) => {
    setDisplay((cur) => {
      if (fresh || cur === '0' || cur === 'Error') return d;
      return cur.replace('-', '').replace('.', '').length >= 14 ? cur : cur + d;
    });
    setPct(null);
    setFresh(false);
  }, [fresh]);

  const dot = useCallback(() => {
    setDisplay((cur) => (fresh || cur === 'Error' ? '0.' : cur.includes('.') ? cur : cur + '.'));
    setPct(null);
    setFresh(false);
  }, [fresh]);

  const operate = useCallback((next: Op) => {
    const cur = display === 'Error' ? 0 : parseFloat(display);
    const chain = acc !== null && op !== null && (!fresh || pct !== null);
    if (chain) {
      const r = apply(acc!, op!, cur);
      setAcc(Number.isFinite(r) ? r : null);
      setDisplay(tidy(r));
    } else {
      setAcc(cur);
    }
    setOp(next);
    setFresh(true);
    setPct(null);
    setTrail(`${tidy(chain ? apply(acc!, op!, cur) : cur)} ${next}`);
  }, [acc, op, display, fresh, pct]);

  const equals = useCallback(() => {
    if (acc === null || !op) return;
    const cur = parseFloat(display);
    const r = apply(acc, op, cur);
    setTrail(`${tidy(acc)} ${op} ${pct ?? tidy(cur)} =`);
    setPct(null);
    setDisplay(tidy(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
  }, [acc, op, display]);

  const clear = useCallback(() => {
    setDisplay('0'); setAcc(null); setOp(null); setFresh(true); setTrail(''); setPct(null);
  }, []);

  const back = useCallback(() => {
    if (fresh) return;
    setDisplay((cur) => (cur.length <= 1 || (cur.length === 2 && cur.startsWith('-')) ? '0' : cur.slice(0, -1)));
  }, [fresh]);

  const sign = useCallback(() => {
    setDisplay((cur) => (cur === '0' || cur === 'Error' ? cur : cur.startsWith('-') ? cur.slice(1) : '-' + cur));
  }, []);

  /**
   * Percent, the way a phone does it. After "200 + 10", % turns the 10 into 10% OF 200 (= 20), so = gives 220.
   * After "200 × 10" or "200 ÷ 10" it is simply 10/100. On its own it is the number divided by 100.
   */
  const percent = useCallback(() => {
    const cur = parseFloat(display);
    if (!Number.isFinite(cur)) return;
    if (acc !== null && op) {
      const value = op === '+' || op === '-' ? (acc * cur) / 100 : cur / 100;
      setDisplay(tidy(value));
      setPct(`${tidy(cur)}%`);
      setTrail(`${tidy(acc)} ${op} ${tidy(cur)}%`);
    } else {
      setDisplay(tidy(cur / 100));
      setTrail(`${tidy(cur)}%`);
    }
    setFresh(true);
  }, [display, acc, op]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') return onClose();
      if (/^[0-9]$/.test(e.key)) digit(e.key);
      else if (e.key === '.' || e.key === ',') dot();
      else if (e.key === '+') operate('+');
      else if (e.key === '-') operate('-');
      else if (e.key === '*' || e.key.toLowerCase() === 'x') operate('×');
      else if (e.key === '/') { e.preventDefault(); operate('÷'); }
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
      else if (e.key === 'Backspace') back();
      else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') clear();
      else if (e.key === '%') percent();
      else return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [digit, dot, operate, equals, back, clear, percent, onClose]);

  useEffect(() => {
    panel.current?.focus();
  }, []);

  const key = (label: React.ReactNode, onClick: () => void, tone: 'num' | 'fn' | 'op' | 'eq' = 'num', aria?: string, wide = false) => {
    const tones = {
      num: 'bg-white text-gray-900 hover:bg-gray-100 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700',
      fn: 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-zinc-700 dark:text-gray-100 dark:hover:bg-zinc-600',
      op: `bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60`,
      eq: 'bg-blue-600 text-white hover:bg-blue-700',
    } as const;
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={aria}
        className={`h-12 rounded-xl text-lg font-semibold shadow-sm transition-colors active:scale-95 ${tones[tone]} ${wide ? 'col-span-2' : ''}`}
      >
        {label}
      </button>
    );
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Calculator"
        className="w-full max-w-[320px] rounded-3xl border border-gray-200 bg-gray-50 p-4 shadow-2xl outline-none dark:border-white/10 dark:bg-[#1A1740]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-tight text-gray-900 dark:text-white">Calculator</h2>
          <button type="button" onClick={onClose} aria-label="Close calculator" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 rounded-2xl bg-white px-4 py-3 text-right shadow-inner dark:bg-zinc-900" aria-live="polite">
          <div className="h-4 truncate text-xs text-gray-400">{trail}</div>
          <div className={`truncate font-bold tabular-nums text-gray-950 dark:text-white ${display.length > 11 ? 'text-2xl' : 'text-4xl'}`}>{display}</div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {key('C', clear, 'fn', 'Clear')}
          {key('±', sign, 'fn', 'Change sign')}
          {key('%', percent, 'fn', 'Percent: after 200 + 10 it means 10% of 200')}
          {key('÷', () => operate('÷'), 'op', 'Divide')}
          {key('7', () => digit('7'))}{key('8', () => digit('8'))}{key('9', () => digit('9'))}
          {key('×', () => operate('×'), 'op', 'Multiply')}
          {key('4', () => digit('4'))}{key('5', () => digit('5'))}{key('6', () => digit('6'))}
          {key('−', () => operate('-'), 'op', 'Subtract')}
          {key('1', () => digit('1'))}{key('2', () => digit('2'))}{key('3', () => digit('3'))}
          {key('+', () => operate('+'), 'op', 'Add')}
          {key('0', () => digit('0'), 'num', undefined, true)}
          {key('.', dot, 'num', 'Decimal point')}
          {key('=', equals, 'eq', 'Equals')}
        </div>
        <p className="mt-2 text-center text-[11px] text-gray-400">
          Tip: <span className="font-semibold">200 + 10 % =</span> gives 220 (10% of 200 added)
        </p>
        <button type="button" onClick={back} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-800">
          <Delete className="h-3.5 w-3.5" /> Backspace
        </button>
      </div>
    </div>,
    document.body
  );
}
