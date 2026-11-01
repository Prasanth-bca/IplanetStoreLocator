'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle, Download, Home, Loader2, NotebookPen, Pencil, Phone, Plus, Search, Trash2, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatDay } from '@/lib/offers/dates';
import { formatPhone, NoteStatus, STATUS_LABEL } from '@/lib/billing/validate';

interface Note {
  id: string;
  bookingDate: string;
  billedPhone: string | null;
  dialledPhone: string | null;
  customerName: string | null;
  model: string | null;
  location: string | null;
  status: NoteStatus;
  invoice: string | null;
  value: number | null;
  remarks: string | null;
  agentCode: string | null;
  agentName: string;
  updatedAt: string;
  updatedByName: string | null;
  mine: boolean;
  canEdit: boolean;
  canDelete: boolean;
}
interface Listing {
  today: string;
  items: Note[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  agents: { id: string; name: string; count: number }[];
}
interface StoreLite {
  posCode: string;
  storeName: string;
  city: string;
}

const STATUS_STYLE: Record<NoteStatus, string> = {
  NOTED: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  NOT_BILLED: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  BILLED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
};
const input =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white';
/** Today's date in India, YYYY-MM-DD, whatever the device's own time zone is. */
const todayInIndia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const rupee = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const AGENT_KEY = 'iplanet-agent-code';

type Form = Record<string, string>;
const blankForm = (today: string): Form => {
  let agentCode = '';
  try {
    agentCode = localStorage.getItem(AGENT_KEY) ?? '';
  } catch {
    /* blocked: leave it blank */
  }
  return { bookingDate: today, billedPhone: '', dialledPhone: '', customerName: '', model: '', location: '', status: 'NOTED', invoice: '', value: '', remarks: '', agentCode };
};
const toForm = (n: Note): Form => ({
  bookingDate: n.bookingDate, billedPhone: formatPhone(n.billedPhone), dialledPhone: formatPhone(n.dialledPhone), customerName: n.customerName ?? '', model: n.model ?? '',
  location: n.location ?? '', status: n.status, invoice: n.invoice ?? '', value: n.value === null ? '' : String(n.value), remarks: n.remarks ?? '', agentCode: n.agentCode ?? '',
});

export default function BillingNotesPage() {
  const { user } = useCurrentUser();
  const isAdmin = user?.role === 'ADMIN';
  const [data, setData] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ text: string; missing: boolean } | null>(null);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [location, setLocation] = useState('');
  const [agent, setAgent] = useState('');
  const [page, setPage] = useState(0);
  const [stores, setStores] = useState<StoreLite[]>([]);
  const [editor, setEditor] = useState<{ id: string | null; form: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDq(q);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (dq.trim()) p.set('q', dq.trim());
    if (status) p.set('status', status);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (location) p.set('location', location);
    if (agent) p.set('agent', agent);
    return p;
  }, [dq, status, from, to, location, agent]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams(params);
      p.set('page', String(page));
      const res = await fetch(`/api/billing-notes?${p}`);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(b.error || 'The notes could not be loaded.'), { missing: !!b.tableMissing });
      setData(b);
      setError(null);
    } catch (e) {
      setData(null);
      setError({ text: e instanceof Error ? e.message : 'The notes could not be loaded.', missing: !!(e as { missing?: boolean }).missing });
    } finally {
      setLoading(false);
    }
  }, [params, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch('/api/stores/list')
      .then((r) => (r.ok ? r.json() : { stores: [] }))
      .then((b) => setStores(b.stores ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const editorOpen = editor !== null;
  useEffect(() => {
    if (!editorOpen) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !saving && setEditor(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [editorOpen, saving]);

  const set = (k: string, v: string) =>
    setEditor((e) => {
      if (!e) return e;
      const form = { ...e.form, [k]: v };
      // Typing an invoice number means it has been billed; clearing it takes that back.
      if (k === 'invoice') {
        if (v.trim() && form.status !== 'BILLED') form.status = 'BILLED';
        else if (!v.trim() && form.status === 'BILLED') form.status = 'NOTED';
      }
      return { ...e, form };
    });

  const save = async () => {
    if (!editor) return;
    setSaving(true);
    setFormErrors([]);
    try {
      const res = await fetch(editor.id ? `/api/billing-notes/${editor.id}` : '/api/billing-notes', {
        method: editor.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editor.form),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormErrors(b.errors ?? [b.error || 'The note could not be saved.']);
        return;
      }
      try {
        if (editor.form.agentCode.trim()) localStorage.setItem(AGENT_KEY, editor.form.agentCode.trim());
      } catch {
        /* ignore */
      }
      setEditor(null);
      setToast({ ok: true, text: editor.id ? 'Changes saved.' : 'Note added.' });
      await load();
    } catch {
      setFormErrors(['Something went wrong. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n: Note) => {
    if (!window.confirm(`Delete the note for ${n.customerName || formatPhone(n.billedPhone) || formatPhone(n.dialledPhone) || n.model || 'this customer'} permanently?`)) return;
    setBusyId(n.id);
    try {
      const res = await fetch(`/api/billing-notes/${n.id}`, { method: 'DELETE' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || 'Could not delete.');
      setToast({ ok: true, text: 'Deleted.' });
      await load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : 'Could not delete.' });
    } finally {
      setBusyId(null);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = !!(dq || status || from || to || location || agent);
  const reset = () => {
    setQ('');
    setDq('');
    setStatus('');
    setFrom('');
    setTo('');
    setLocation('');
    setAgent('');
    setPage(0);
  };
  const exportHref = `/api/billing-notes/export${params.toString() ? `?${params}` : ''}`;
  const field = (label: string, key: string, opts: { type?: string; hint?: string; list?: string; wide?: boolean; inputMode?: 'numeric' | 'tel' | 'text'; placeholder?: string } = {}) => (
    <div className={opts.wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={`bn-${key}`} className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">{label}</label>
      <input id={`bn-${key}`} type={opts.type ?? 'text'} inputMode={opts.inputMode} list={opts.list} placeholder={opts.placeholder} value={editor?.form[key] ?? ''} max={opts.type === 'date' ? data?.today : undefined} onChange={(e) => set(key, e.target.value)} className={input} />
      {opts.hint && <p className="mt-1 text-[11px] text-gray-400">{opts.hint}</p>}
    </div>
  );

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-pal-bar-dark/90 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="Back to home" className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-zinc-800 dark:text-gray-300"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="flex items-center gap-2 truncate text-lg font-extrabold text-gray-950 dark:text-white"><NotebookPen className="h-5 w-5 shrink-0 text-blue-600" /> Billing notes</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setFormErrors([]); setEditor({ id: null, form: blankForm(data?.today ?? todayInIndia()) }); }} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add note</span><span className="sm:hidden">Add</span>
            </button>
            <Link href="/" aria-label="Home" title="Home" className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-300"><Home className="h-4 w-4" /></Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8 2xl:px-12">
        <section className="space-y-1 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Customers billed on a different number</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Note the customer you spoke to when the invoice was raised on <strong>another</strong> phone number, so the billing team can match the sale to your call.
            {isAdmin ? ' You are seeing everyone’s notes.' : ' You see and edit only your own notes.'}
          </p>
        </section>

        {/* filters */}
        <section className="space-y-3 rounded-3xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-pal-card-dark">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a phone number, name, model, invoice…" aria-label="Search notes" className={`${input} pl-9`} />
            </div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">From <input type="date" value={from} max={to || data?.today} onChange={(e) => { setFrom(e.target.value); setPage(0); }} aria-label="From date" className={`${input} w-auto`} /></label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">To <input type="date" value={to} min={from || undefined} max={data?.today} onChange={(e) => { setTo(e.target.value); setPage(0); }} aria-label="To date" className={`${input} w-auto`} /></label>
            <select value={location} onChange={(e) => { setLocation(e.target.value); setPage(0); }} aria-label="Filter by store" className={`${input} w-auto`}>
              <option value="">All stores</option>
              {stores.map((s) => <option key={s.posCode} value={s.posCode}>{s.posCode} · {s.storeName}</option>)}
            </select>
            {isAdmin && (
              <select value={agent} onChange={(e) => { setAgent(e.target.value); setPage(0); }} aria-label="Filter by agent" className={`${input} w-auto`}>
                <option value="">All agents</option>
                {data?.agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.count})</option>)}
              </select>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
              {([['', 'All'], ['NOTED', 'Noted'], ['NOT_BILLED', 'Not billed yet'], ['BILLED', 'Billed']] as const).map(([k, label]) => {
                const n = k ? data?.counts[k] : data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : undefined;
                return (
                  <button key={k} type="button" aria-pressed={status === k} onClick={() => { setStatus(k); setPage(0); }} className={`rounded-full border px-3 py-1 text-xs font-bold transition ${status === k ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300 dark:border-white/10 dark:text-gray-300'}`}>
                    {label}{n !== undefined && <span className="ml-1.5 opacity-70">{n}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 text-xs">
              {filtered && <button type="button" onClick={reset} className="font-semibold text-blue-600 hover:underline">Clear filters</button>}
              <a href={exportHref} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"><Download className="h-3.5 w-3.5" /> Excel</a>
            </div>
          </div>
        </section>

        {toast && (
          <p role="status" className={`flex items-start gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold ${toast.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'}`}>
            {toast.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />} {toast.text}
          </p>
        )}

        {/* list */}
        {loading && !data ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error.text}</span></p>
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white/60 px-4 py-14 text-center dark:border-white/15 dark:bg-white/5">
            <NotebookPen className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{filtered ? 'No notes match these filters.' : 'No notes yet.'}</p>
            {!filtered && <p className="mt-1 text-xs text-gray-500">Press “Add note” when a customer is billed on a different number from the one you called.</p>}
          </div>
        ) : data ? (
          <>
            <ul className={`space-y-2.5 ${loading ? 'opacity-60' : ''}`}>
              {data.items.map((n) => (
                <li key={n.id} className="rounded-2xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-pal-card-dark">
                  <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                    <div className="min-w-[210px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-extrabold text-gray-900 dark:text-white">{n.customerName || 'Customer'}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[n.status]}`}>{STATUS_LABEL[n.status]}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{[n.model, n.location].filter(Boolean).join(' · ')}{n.model || n.location ? ' · ' : ''}{formatDay(n.bookingDate)}</p>
                      <p className="mt-0.5 text-[11px] text-gray-400">{isAdmin || !n.mine ? `${n.agentName}${n.agentCode ? ` (${n.agentCode})` : ''}` : n.agentCode ? `Agent id ${n.agentCode}` : ''}</p>
                    </div>
                    {(n.billedPhone || n.dialledPhone) && (
                      <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                        {n.billedPhone && <span className="rounded-xl bg-blue-50 px-3 py-1.5 dark:bg-blue-950/40"><span className="block font-sans text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Billed on</span>{formatPhone(n.billedPhone)}</span>}
                        {n.billedPhone && n.dialledPhone && <ArrowRight className="hidden h-4 w-4 text-gray-300 sm:block" aria-hidden />}
                        {n.dialledPhone && <span className="rounded-xl bg-gray-100 px-3 py-1.5 dark:bg-zinc-800"><span className="block font-sans text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"><Phone className="mr-1 inline h-2.5 w-2.5" />Dialled</span>{formatPhone(n.dialledPhone)}</span>}
                      </div>
                    )}
                    {(n.invoice || n.value !== null) && (
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        {n.invoice && <p>Invoice <strong className="font-mono">{n.invoice}</strong></p>}
                        {n.value !== null && <p>Value <strong>{rupee(n.value)}</strong></p>}
                      </div>
                    )}
                    <div className="ml-auto flex items-center gap-1.5">
                      {n.canEdit && <button type="button" onClick={() => { setFormErrors([]); setEditor({ id: n.id, form: toForm(n) }); }} aria-label={`Edit note for ${n.customerName || formatPhone(n.billedPhone) || 'this customer'}`} title="Edit" className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"><Pencil className="h-4 w-4" /></button>}
                      {n.canDelete && <button type="button" onClick={() => remove(n)} disabled={busyId === n.id} aria-label="Delete note" title="Delete" className="rounded-lg bg-red-50 p-2 text-red-600 hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/40 dark:text-red-300">{busyId === n.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>}
                    </div>
                  </div>
                  {n.remarks && <p className="mt-2.5 whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">{n.remarks}</p>}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Showing {data.page * data.pageSize + 1}–{Math.min(data.total, data.page * data.pageSize + data.pageSize)} of {data.total}</span>
              {pages > 1 && (
                <span className="inline-flex items-center gap-1.5">
                  <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold disabled:opacity-40 dark:border-white/10">Previous</button>
                  <span>Page {page + 1} of {pages}</span>
                  <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-lg border border-gray-200 px-3 py-1 font-semibold disabled:opacity-40 dark:border-white/10">Next</button>
                </span>
              )}
            </div>
          </>
        ) : null}
      </main>

      <datalist id="bn-stores">{stores.map((s) => <option key={s.posCode} value={s.posCode}>{s.storeName}</option>)}</datalist>

      {editor && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && !saving && setEditor(null)}>
          <div role="dialog" aria-modal="true" aria-label={editor.id ? 'Edit note' : 'Add note'} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-pal-card-dark sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">{editor.id ? 'Edit note' : 'Add a billing note'}</h3>
              <p className="sr-only">Every field is optional.</p>
              <button type="button" onClick={() => setEditor(null)} disabled={saving} aria-label="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-3.5 overflow-y-auto px-5 py-4 sm:grid-cols-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-2">Every field is optional. Fill in whatever you know; at least one detail is needed.</p>
              {field('Date of the call / sale', 'bookingDate', { type: 'date', hint: 'Left blank, it is saved as today.' })}
              {field('Customer name', 'customerName', { placeholder: 'Optional' })}
              {field('Billed phone number', 'billedPhone', { inputMode: 'tel', placeholder: '10-digit mobile', hint: 'The number the invoice was raised on. Optional.' })}
              {field('Dialled phone number', 'dialledPhone', { inputMode: 'tel', placeholder: '10-digit mobile', hint: 'The number you spoke to. Optional; if both are given they must differ.' })}
              {field('Model', 'model', { placeholder: 'e.g. M5 Air, 17 Pro, Airpods 5' })}
              {field('Store', 'location', { list: 'bn-stores', placeholder: 'Store code, e.g. TAM', hint: 'Pick from the list or type the code.' })}
              <div>
                <label htmlFor="bn-status" className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">Status</label>
                <select id="bn-status" value={editor.form.status} onChange={(e) => set('status', e.target.value)} className={input}>
                  <option value="NOTED">Noted</option>
                  <option value="NOT_BILLED">Not billed yet</option>
                  <option value="BILLED">Billed</option>
                </select>
              </div>
              {field('Agent id (optional)', 'agentCode', { hint: 'Your id in the calling system. Remembered on this device.' })}
              {field('Invoice number', 'invoice', { hint: 'Optional. Adding one marks it Billed.' })}
              {field('Value (₹)', 'value', { inputMode: 'numeric', placeholder: 'Optional' })}
              <div className="sm:col-span-2">
                <label htmlFor="bn-remarks" className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">Remarks</label>
                <textarea id="bn-remarks" rows={3} maxLength={500} value={editor.form.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="e.g. Customer asked for a call back from the store" className={input} />
                <p className="mt-1 text-right text-[11px] text-gray-400">{editor.form.remarks.length}/500</p>
              </div>
            </div>
            <div className="border-t border-gray-100 px-5 py-3.5 dark:border-white/10">
              {formErrors.length > 0 && (
                <ul role="alert" className="mb-3 space-y-1 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {formErrors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditor(null)} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-white/10 dark:text-gray-200">Cancel</button>
                <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} {editor.id ? 'Save changes' : 'Add note'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
