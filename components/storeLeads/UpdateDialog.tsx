'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, BellRing, CheckCircle, Loader2, Lock, MessageSquarePlus, Phone, X } from 'lucide-react';
import { CONVERSIONS, CONVERSION_LABEL, INTERESTS, INTEREST_LABEL, VISITS, VISIT_LABEL, type Conversion, type Interest, type Visit } from '@/lib/storeLeads/rules';
import { fieldCls, fmtDateTime, fmtMobile, fmtWait, InterestPill, StatusBadge } from './common';
import type { StatusKey } from '@/lib/storeLeads/rules';

export interface LeadRow {
  id: string;
  customerName: string;
  customerMobile: string;
  requirement: string;
  remarks: string | null;
  assignedAt: string;
  interest: string | null;
  visitIntention: string | null;
  conversion: string | null;
  status: StatusKey;
  statusLabel: string;
  firstResponseAt: string | null;
  lastActivityAt: string;
  closedAt: string | null;
  lastRemark: string | null;
  reminderLevel: 0 | 1 | 2;
  minutesWaiting: number | null;
  overdueFollowUp: boolean;
  posCode?: string;
  storeName?: string;
  sharedByName?: string;
  billedName?: string | null;
  billedMobile?: string | null;
}

interface Event {
  at: string;
  kind: string;
  by: string | null;
  note: string | null;
  changes: string | null;
  dueAt?: string;
  readAt?: string | null;
}

/** One group of mutually exclusive buttons (the three status toggles). */
function Toggle<T extends string>({ legend, options, labels, value, onChange, disabled, tone }: { legend: string; options: readonly T[]; labels: Record<T, string>; value: T | null; onChange: (v: T) => void; disabled?: boolean; tone?: Partial<Record<T, string>> }) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">{legend}</legend>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? (tone?.[o] ?? 'border-blue-600 bg-blue-600 text-white') : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-200'}`}
            >
              {labels[o]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const INTEREST_TONE: Partial<Record<Interest, string>> = { COLD: 'border-sky-500 bg-sky-500 text-white', WARM: 'border-amber-500 bg-amber-500 text-white', HOT: 'border-red-600 bg-red-600 text-white' };
const CONVERSION_TONE: Partial<Record<Conversion, string>> = { CLOSED: 'border-emerald-600 bg-emerald-600 text-white', NOT_CLOSED: 'border-amber-500 bg-amber-500 text-white', NOT_INTERESTED: 'border-gray-600 bg-gray-600 text-white' };

const EVENT_LABEL: Record<string, string> = { ASSIGNED: 'Lead received', FOLLOW_UP: 'Follow-up', CLOSED: 'Closed', REMINDER_20: '20-minute reminder', REMINDER_40: '40-minute reminder (high priority)' };

export function UpdateDialog({ lead, apiBase, historyBase, isAdmin, onClose, onSaved }: { lead: LeadRow; apiBase: string; /** Where the history is read from, when it differs from where updates go (admin). */ historyBase?: string; isAdmin: boolean; onClose: () => void; onSaved: (lead: LeadRow, celebrate: boolean) => void }) {
  const [interest, setInterest] = useState<Interest | null>(lead.interest as Interest | null);
  const [visit, setVisit] = useState<Visit | null>(lead.visitIntention as Visit | null);
  const [conversion, setConversion] = useState<Conversion | null>(lead.conversion as Conversion | null);
  const [billedName, setBilledName] = useState(lead.billedName ?? '');
  const [billedMobile, setBilledMobile] = useState(lead.billedMobile ?? '');
  const [remark, setRemark] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [events, setEvents] = useState<Event[] | null>(null);

  // A store cannot change a lead once it is Closed; it can still add remarks.
  const locked = lead.conversion === 'CLOSED' && !isAdmin;

  useEffect(() => {
    let live = true;
    fetch(`${historyBase ?? apiBase}/${lead.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => live && setEvents(b?.timeline ?? []))
      .catch(() => live && setEvents([]));
    return () => {
      live = false;
    };
  }, [apiBase, historyBase, lead.id]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [saving, onClose]);

  const body = useMemo(() => {
    const b: Record<string, unknown> = {};
    if (!locked) {
      if (interest && interest !== lead.interest) b.interest = interest;
      if (visit && visit !== lead.visitIntention) b.visitIntention = visit;
      if (conversion && conversion !== lead.conversion) b.conversion = conversion;
      if (conversion === 'CLOSED') {
        b.billedName = billedName;
        b.billedMobile = billedMobile;
        if (conversion === lead.conversion && billedName === (lead.billedName ?? '') && billedMobile === (lead.billedMobile ?? '')) {
          delete b.billedName;
          delete b.billedMobile;
        }
      }
    }
    if (remark.trim()) b.remark = remark;
    return b;
  }, [interest, visit, conversion, billedName, billedMobile, remark, lead, locked]);
  const changed = Object.keys(body).length > 0;

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch(`${apiBase}/${lead.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(b.errors ?? [b.error || 'The update could not be saved.']);
        return;
      }
      onSaved(b.lead, !!b.celebrate);
    } catch {
      setErrors(['Something went wrong. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Follow-up for ${lead.customerName}`} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-pal-card-dark sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold text-gray-900 dark:text-white">{lead.customerName}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <a href={`tel:${lead.customerMobile}`} className="inline-flex items-center gap-1 font-mono font-semibold text-blue-700 dark:text-blue-300"><Phone className="h-3 w-3" />{fmtMobile(lead.customerMobile)}</a>
              <span>{lead.requirement}</span>
              <span>Received {fmtDateTime(lead.assignedAt)}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={lead.status} /><InterestPill value={lead.interest} />{isAdmin && lead.sharedByName && <span className="text-[11px] text-gray-500">Shared by {lead.sharedByName}</span>}</div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {lead.remarks && (
            <div className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-200"><span className="mb-0.5 block text-[10.5px] font-bold uppercase tracking-wide text-gray-400">Initial remarks</span>{lead.remarks}</div>
          )}

          {locked && (
            <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> This lead is Closed, so its status and billing details are locked. You can still add follow-up remarks. Ask an admin if it was closed by mistake.</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Toggle legend="1. Customer interest level" options={INTERESTS} labels={INTEREST_LABEL} value={interest} onChange={setInterest} disabled={locked} tone={INTEREST_TONE} />
            <Toggle legend="2. Customer visit intention" options={VISITS} labels={VISIT_LABEL} value={visit} onChange={setVisit} disabled={locked} />
          </div>
          <Toggle legend="3. Lead conversion status" options={CONVERSIONS} labels={CONVERSION_LABEL} value={conversion} onChange={setConversion} disabled={locked} tone={CONVERSION_TONE} />

          {conversion === 'CLOSED' && (
            <div className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:grid-cols-2">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 sm:col-span-2">To close this lead, enter who was billed. Both are required.</p>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Billed customer name
                <input value={billedName} onChange={(e) => setBilledName(e.target.value)} disabled={locked} maxLength={80} autoComplete="off" className={`${fieldCls} mt-1 font-normal`} />
              </label>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">Billed mobile number
                <input value={billedMobile} onChange={(e) => setBilledMobile(e.target.value)} disabled={locked} inputMode="tel" autoComplete="off" placeholder="10-digit mobile" className={`${fieldCls} mt-1 font-normal`} />
              </label>
            </div>
          )}

          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5"><MessageSquarePlus className="h-3.5 w-3.5" /> Follow-up remark</span>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} maxLength={500} placeholder="e.g. Customer will visit today · asked for a callback tomorrow · comparing prices · purchased the product" className={`${fieldCls} mt-1 font-normal`} />
            <span className="mt-1 block text-right text-[11px] font-normal text-gray-400">Each remark is added to the history; earlier ones are never overwritten. {remark.length}/500</span>
          </label>

          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">History</h4>
            {events === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            ) : events.length === 0 ? (
              <p className="text-xs text-gray-400">No history yet.</p>
            ) : (
              <ol className="space-y-2 border-l-2 border-gray-100 pl-4 dark:border-white/10">
                {events.map((e, i) => {
                  const reminder = e.kind.startsWith('REMINDER');
                  return (
                    <li key={i} className="relative text-xs">
                      <span className={`absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full ${reminder ? 'bg-red-500' : e.kind === 'CLOSED' ? 'bg-emerald-500' : e.kind === 'ASSIGNED' ? 'bg-gray-400' : 'bg-blue-500'}`} />
                      <p className="font-bold text-gray-800 dark:text-gray-100">
                        {reminder && <BellRing className="mr-1 inline h-3 w-3 text-red-500" />}
                        {EVENT_LABEL[e.kind] ?? e.kind} <span className="font-normal text-gray-400">· {fmtDateTime(e.at)}{e.by ? ` · ${e.by}` : ''}</span>
                      </p>
                      {reminder && e.dueAt && <p className="text-gray-500">Fell due {fmtDateTime(e.dueAt)} · {e.readAt ? `acknowledged ${fmtDateTime(e.readAt)}` : 'not acknowledged'}</p>}
                      {e.changes && <p className="text-gray-600 dark:text-gray-300">{e.changes}</p>}
                      {e.note && <p className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">{e.note}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
            {lead.minutesWaiting !== null && lead.minutesWaiting >= 1 && <p className="mt-2 text-xs font-semibold text-red-600">Waiting for a response for {fmtWait(lead.minutesWaiting)}.</p>}
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-3.5 dark:border-white/10">
          {errors.length > 0 && (
            <ul role="alert" className="mb-3 space-y-1 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {errors.map((e, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{e}</li>)}
            </ul>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400">{changed ? 'Unsaved changes.' : 'Change a status or write a remark, then save.'}</p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-white/10 dark:text-gray-200">Cancel</button>
              <button type="button" onClick={save} disabled={saving || !changed} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Save follow-up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
