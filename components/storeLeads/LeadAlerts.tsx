'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { fmtDateTime, fmtWait, useServerClock } from './common';

interface Alert {
  id: string;
  ids: string[];
  leadId: string;
  level: 1 | 2;
  customerName: string;
  requirement: string;
  assignedAt: string;
  dueAt: string;
  minutesWaiting: number;
}

const COMPACT_AFTER_MS = 12_000;

/**
 * Reminder pop-ups for a signed-in STORE login, on every page. The server decides what is due (from each lead's
 * assignment time) and keeps it until the store responds or dismisses it, so a refresh, a closed tab or a different
 * page changes nothing. Nothing is shown to admin or sales logins.
 */
export function LeadAlerts() {
  const { user } = useCurrentUser();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [serverNow, setServerNow] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const busy = useRef(false);
  // When each alert was first shown: after a few seconds it shrinks to one line so it never blocks the page.
  const seen = useRef<Map<string, number>>(new Map());
  const clock = useServerClock(serverNow);

  const load = useCallback(async () => {
    if (busy.current || document.visibilityState !== 'visible') return;
    busy.current = true;
    try {
      const res = await fetch('/api/lead-alerts');
      if (!res.ok) return;
      const b = await res.json();
      for (const a of (b.alerts ?? []) as Alert[]) if (!seen.current.has(a.id)) seen.current.set(a.id, Date.now());
      setAlerts(b.alerts ?? []);
      setServerNow(b.serverNow ?? null);
    } catch {
      /* offline: try again on the next beat */
    } finally {
      busy.current = false;
    }
  }, []);

  const [, setTick] = useState(0);
  const isStore = user?.role === 'STORE';
  useEffect(() => {
    if (!isStore) return;
    const t = setInterval(() => setTick((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [isStore]);
  useEffect(() => {
    if (!isStore) return;
    load();
    const t = setInterval(load, 30_000);
    const vis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [isStore, load]);

  const dismiss = (a: Alert) => {
    setHidden((h) => new Set(h).add(a.id));
    fetch('/api/lead-alerts/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: a.ids }) }).catch(() => {});
  };

  if (!isStore) return null;
  const shown = alerts.filter((a) => !hidden.has(a.id)).sort((a, b) => b.level - a.level || a.assignedAt.localeCompare(b.assignedAt));
  if (shown.length === 0) return null;
  const nowMs = clock().getTime();

  return (
    <div aria-live="assertive" className="fixed right-3 top-[76px] z-[100] flex w-[min(94vw,360px)] flex-col gap-1.5">
      {shown.slice(0, 3).map((a) => {
        const waited = Math.max(a.minutesWaiting, Math.floor((nowMs - new Date(a.assignedAt).getTime()) / 60000));
        const urgent = a.level === 2;
        const compact = nowMs - (seen.current.get(a.id) ?? nowMs) > COMPACT_AFTER_MS;
        const open = () => window.location.assign(`/store-leads?lead=${a.leadId}`);
        if (compact) {
          return (
            <div key={a.id} role="alert" className={`lead-toast flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs shadow-lg ${urgent ? 'border-red-700 bg-red-600 text-white' : 'border-red-200 bg-white text-gray-900 dark:border-red-900/60 dark:bg-pal-card-dark dark:text-white'}`}>
              <BellRing className={`h-3.5 w-3.5 shrink-0 ${urgent ? 'text-white' : 'text-red-600'}`} />
              <button type="button" onClick={open} className="min-w-0 flex-1 truncate text-left font-semibold" title="Open this lead"><strong>{a.customerName}</strong> · waiting {fmtWait(waited)}{urgent ? ' · 40 min+' : ''}</button>
              <button type="button" onClick={() => dismiss(a)} aria-label="Dismiss" className={`rounded p-0.5 ${urgent ? 'hover:bg-red-700' : 'hover:bg-gray-100 dark:hover:bg-white/10'}`}><X className="h-3.5 w-3.5" /></button>
            </div>
          );
        }
        return (
          <div key={a.id} role="alert" className={`lead-toast rounded-2xl border p-3.5 shadow-2xl ${urgent ? 'border-red-700 bg-red-600 text-white' : 'border-red-200 bg-white text-gray-900 dark:border-red-900/60 dark:bg-pal-card-dark dark:text-white'}`}>
            <div className="flex items-start gap-2.5">
              <BellRing className={`mt-0.5 h-4 w-4 shrink-0 ${urgent ? 'text-white' : 'text-red-600'}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold leading-tight">{urgent ? `Pending ${fmtWait(waited)} without a response` : 'A lead is awaiting your response'}</p>
                <p className={`mt-1 truncate text-xs ${urgent ? 'text-red-50' : 'text-gray-600 dark:text-gray-300'}`}><strong>{a.customerName}</strong> · {a.requirement}</p>
                <p className={`text-[11px] ${urgent ? 'text-red-100' : 'text-gray-500 dark:text-gray-400'}`}>Received {fmtDateTime(a.assignedAt)} · {fmtWait(waited)} ago</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={open} className={`rounded-lg px-3 py-1 text-xs font-bold ${urgent ? 'bg-white text-red-700' : 'bg-red-600 text-white'}`}>Open lead</button>
                  <button type="button" onClick={() => dismiss(a)} className={`rounded-lg px-3 py-1 text-xs font-semibold ${urgent ? 'text-red-50 hover:bg-red-700' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'}`}>Dismiss</button>
                </div>
              </div>
              <button type="button" onClick={() => dismiss(a)} aria-label="Dismiss" className={`rounded p-1 ${urgent ? 'hover:bg-red-700' : 'hover:bg-gray-100 dark:hover:bg-white/10'}`}><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        );
      })}
      {shown.length > 3 && <p className="rounded-xl bg-gray-900/85 px-3 py-1.5 text-center text-xs font-semibold text-white">+{shown.length - 3} more waiting. Open Received Leads.</p>}
    </div>
  );
}
