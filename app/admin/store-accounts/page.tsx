'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle, Copy, Download, Home, KeyRound, Loader2, UserPlus } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { fieldCls, fmtDateTime } from '@/components/storeLeads/common';

interface StoreRow { posCode: string; storeName: string; city: string; status: string; suggestedUsername: string; account: { userId: string; username: string; active: boolean; lastLoginAt: string | null } | null }
interface Created { posCode: string; storeName: string; username: string; password: string }
const BATCH = 20;

export default function StoreAccountsPage() {
  const [stores, setStores] = useState<StoreRow[] | null>(null);
  const [error, setError] = useState<{ text: string; missing: boolean } | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [created, setCreated] = useState<Created[]>([]);
  const [skipped, setSkipped] = useState<{ posCode: string; reason: string }[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/store-accounts');
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(b.error || 'The stores could not be loaded.'), { missing: !!b.tableMissing });
      setStores(b.stores);
      setError(null);
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : 'The stores could not be loaded.', missing: !!(e as { missing?: boolean }).missing });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (stores ?? []).filter((s) => !words.length || words.every((w) => `${s.posCode} ${s.storeName} ${s.city} ${s.account?.username ?? ''}`.toLowerCase().includes(w)));
  }, [stores, q]);
  const missing = useMemo(() => (stores ?? []).filter((s) => !s.account && s.status === 'Active'), [stores]);

  const toggle = (code: string) => setPick((p) => { const n = new Set(p); n.has(code) ? n.delete(code) : n.add(code); return n; });

  const create = async (codes: string[]) => {
    if (!codes.length) return;
    setBusy(true);
    setSkipped([]);
    setCreated([]);
    setCopied(false);
    const made: Created[] = [];
    const skip: { posCode: string; reason: string }[] = [];
    try {
      for (let i = 0; i < codes.length; i += BATCH) {
        setProgress(`Creating logins ${Math.min(i + BATCH, codes.length)} of ${codes.length}…`);
        const res = await fetch('/api/admin/store-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ posCodes: codes.slice(i, i + BATCH) }) });
        const b = await res.json().catch(() => ({}));
        if (!res.ok) { skip.push({ posCode: '—', reason: b.error || 'A batch failed.' }); break; }
        made.push(...b.created);
        skip.push(...b.skipped);
        setCreated([...made]);
      }
    } finally {
      setSkipped(skip);
      setProgress('');
      setBusy(false);
      setPick(new Set());
      load();
    }
  };

  const text = () => ['Store\tPOS code\tUsername\tPassword', ...created.map((c) => `${c.storeName}\t${c.posCode}\t${c.username}\t${c.password}`)].join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(text()); setCopied(true); } catch { /* the table below can be selected by hand */ } };
  const download = () => {
    const rows = ['Store,POS code,Username,Password', ...created.map((c) => [c.storeName, c.posCode, c.username, c.password].map((v) => `"${v.replace(/"/g, '""')}"`).join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = 'Store_Logins.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-pal-bar-dark/90 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin/store-leads" aria-label="Back to store leads" className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-zinc-800 dark:text-gray-300"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="flex items-center gap-2 truncate text-lg font-extrabold text-gray-950 dark:text-white"><KeyRound className="h-5 w-5 shrink-0 text-blue-600" /> Store accounts</h1>
          </div>
          <div className="flex items-center gap-2"><Link href="/" aria-label="Home" className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-300"><Home className="h-4 w-4" /></Link><ThemeToggle /></div>
        </div>
      </header>

      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8 2xl:px-12">
        <section className="rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">One login for every retail store</h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">Each store logs in with its own username and password and sees only the leads sent to its own POS code. Usernames look like <code className="rounded bg-gray-100 px-1 dark:bg-white/10">store.pbz1</code>. Passwords are random and shown <strong>once</strong>, right after they are created. To change one later, use <Link href="/admin/users" className="font-semibold text-blue-600 underline">Users</Link> and reset the password.</p>
        </section>

        {error ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error.text}</p></div>
        ) : !stores ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
          <>
            {created.length > 0 && (
              <section role="status" className="space-y-3 rounded-3xl border-2 border-emerald-400 bg-emerald-50/70 p-5 dark:border-emerald-700 dark:bg-emerald-950/20">
                <h2 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900 dark:text-emerald-200"><CheckCircle className="h-4 w-4" /> {created.length} store login{created.length === 1 ? '' : 's'} created. Save these passwords now: they cannot be shown again.</h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-sm dark:bg-white/10 dark:text-white"><Copy className="h-3.5 w-3.5" />{copied ? 'Copied' : 'Copy all'}</button>
                  <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-gray-800 shadow-sm dark:bg-white/10 dark:text-white"><Download className="h-3.5 w-3.5" />Download CSV</button>
                </div>
                <div className="max-h-80 overflow-auto rounded-2xl border border-emerald-200 bg-white dark:border-emerald-900/50 dark:bg-zinc-900">
                  <table className="w-full min-w-[520px] text-xs"><thead><tr className="bg-emerald-50 text-left text-[10.5px] uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/40"><th className="px-3 py-2">Store</th><th className="px-3 py-2">POS</th><th className="px-3 py-2">Username</th><th className="px-3 py-2">Password</th></tr></thead>
                    <tbody>{created.map((c) => <tr key={c.username} className="border-t border-gray-100 dark:border-white/10"><td className="px-3 py-1.5">{c.storeName}</td><td className="px-3 py-1.5 font-semibold">{c.posCode}</td><td className="px-3 py-1.5 font-mono">{c.username}</td><td className="px-3 py-1.5 font-mono font-bold">{c.password}</td></tr>)}</tbody></table>
                </div>
              </section>
            )}
            {skipped.length > 0 && <ul className="space-y-1 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{skipped.map((s, i) => <li key={i}><strong>{s.posCode}</strong>: {s.reason}</li>)}</ul>}

            <section className="space-y-3 rounded-3xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-pal-card-dark">
              <div className="flex flex-wrap items-center gap-3">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search store, POS code, city or username" aria-label="Search stores" className={`${fieldCls} min-w-[220px] flex-1`} />
                <span className="text-xs text-gray-500">{stores.length - missing.length} of {stores.length} stores have a login</span>
                <button type="button" onClick={() => setPick(new Set(missing.map((m) => m.posCode)))} disabled={busy || missing.length === 0} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-50 dark:border-white/10 dark:text-gray-200">Select all without a login ({missing.length})</button>
                <button type="button" onClick={() => create(Array.from(pick))} disabled={busy || pick.size === 0} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{busy ? progress : `Create ${pick.size} login${pick.size === 1 ? '' : 's'}`}</button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/10">
                <table className="w-full min-w-[640px] text-xs">
                  <thead><tr className="bg-gray-50 text-left text-[10.5px] uppercase tracking-wide text-gray-500 dark:bg-white/5"><th className="w-10 px-3 py-2" /><th className="px-3 py-2">Store</th><th className="px-3 py-2">POS</th><th className="px-3 py-2">City</th><th className="px-3 py-2">Login</th><th className="px-3 py-2">Last sign-in</th></tr></thead>
                  <tbody>{shown.map((s) => (
                    <tr key={s.posCode} className="border-t border-gray-100 dark:border-white/10">
                      <td className="px-3 py-2">{!s.account && <input type="checkbox" aria-label={`Select ${s.storeName}`} checked={pick.has(s.posCode)} onChange={() => toggle(s.posCode)} disabled={busy} />}</td>
                      <td className="px-3 py-2 font-semibold">{s.storeName}{s.status !== 'Active' && <span className="ml-1.5 text-[10px] font-bold text-gray-400">({s.status})</span>}</td><td className="px-3 py-2">{s.posCode}</td><td className="px-3 py-2">{s.city}</td>
                      <td className="px-3 py-2">{s.account ? <span className="font-mono">{s.account.username}{!s.account.active && <span className="ml-1.5 font-sans font-bold text-red-600">disabled</span>}</span> : <span className="text-gray-400">None yet <span className="font-mono text-gray-300">({s.suggestedUsername})</span></span>}</td>
                      <td className="px-3 py-2 text-gray-500">{s.account?.lastLoginAt ? fmtDateTime(s.account.lastLoginAt) : '—'}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
