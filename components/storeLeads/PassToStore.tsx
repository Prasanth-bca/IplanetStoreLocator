'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, Send, Share2, X } from 'lucide-react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { fieldCls } from '@/components/storeLeads/common';

const newClientId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// One shared lookup of which stores have a login, for every card on the page.
let accountsPromise: Promise<Set<string> | null> | null = null;
function storesWithLogin(): Promise<Set<string> | null> {
  if (!accountsPromise) {
    accountsPromise = fetch('/api/store-leads/stores')
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => (b ? new Set<string>((b.stores ?? []).filter((s: { hasAccount: boolean }) => s.hasAccount).map((s: { posCode: string }) => s.posCode)) : null))
      .catch(() => null);
    accountsPromise.then((v) => { if (!v) accountsPromise = null; });
  }
  return accountsPromise;
}

/** "Pass to store" button + inline form inside a store card. Only for Admin / Sales logins, retail stores only. */
export function PassToStore({ posCode, storeName, category }: { posCode: string; storeName: string; category: string }) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [hasLogin, setHasLogin] = useState<boolean | null>(null);
  const [clientId, setClientId] = useState(newClientId);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [need, setNeed] = useState('');
  const [remarks, setRemarks] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  const allowed = category === 'Retail' && (user?.role === 'ADMIN' || user?.role === 'SALES');
  useEffect(() => {
    if (!open) return;
    storesWithLogin().then((set) => setHasLogin(set ? set.has(posCode) : null));
  }, [open, posCode]);

  if (!allowed) return null;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setErrors([]);
    setDone(null);
    try {
      const res = await fetch('/api/store-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, customerName: name, customerMobile: mobile, requirement: need, remarks, posCode }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setErrors(b.errors ?? [b.error || 'The lead could not be passed.']); return; }
      setDone(`${b.duplicate ? 'Already passed to' : 'Lead passed to'} ${b.storeName ?? storeName}. The store is reminded automatically if it doesn’t respond within 20 minutes.`);
      setName(''); setMobile(''); setNeed(''); setRemarks('');
      setClientId(newClientId());
    } catch {
      setErrors(['Something went wrong. Please check your connection and try again.']);
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={stop} onKeyDown={stop}>
      <button type="button" onClick={() => { setOpen((v) => !v); setDone(null); }} aria-expanded={open} className="btn-maps mt-2" title="Pass a customer lead to this store">
        <Share2 className="h-4 w-4" /><span className="text-[13px]">{open ? 'Close lead form' : 'Pass lead to this store'}</span>
      </button>
      {open && (
        <form onSubmit={submit} noValidate className="mt-2 space-y-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/20">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-100">Pass lead to {storeName} <span className="font-mono font-normal text-gray-500">({posCode})</span></p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-0.5 text-gray-500 hover:bg-white/60"><X className="h-4 w-4" /></button>
          </div>
          {hasLogin === false && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">This store has no login yet, so it can’t receive leads. Ask the admin to create it under Store accounts.</p>}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" aria-label="Customer name" placeholder="Customer name" className={fieldCls} />
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" autoComplete="off" aria-label="Customer contact number" placeholder="Contact number" className={fieldCls} />
            <input value={need} onChange={(e) => setNeed(e.target.value)} maxLength={120} autoComplete="off" aria-label="Customer requirement" placeholder="Requirement, e.g. iPhone 17 Pro 256GB" className={`${fieldCls} sm:col-span-2`} />
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} maxLength={500} aria-label="Remarks" placeholder="Remarks (optional)" className={`${fieldCls} sm:col-span-2`} />
          </div>
          {errors.length > 0 && <ul role="alert" className="space-y-1 text-xs text-red-700 dark:text-red-300">{errors.map((er, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{er}</li>)}</ul>}
          {done && <p role="status" className="flex items-start gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{done}</p>}
          <div className="flex justify-end"><button type="submit" disabled={sending || hasLogin === false} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60">{sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Pass to store</button></div>
        </form>
      )}
    </div>
  );
}
