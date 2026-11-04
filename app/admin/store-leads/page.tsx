'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, BellRing, Download, Home, Inbox, KeyRound, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { Summary } from '@/lib/storeLeads/rules';
import { fieldCls, fmtDateTime, fmtMobile, fmtWait, InterestPill, PeriodPicker, periodLabel, Stat, StatusBadge, usePolling } from '@/components/storeLeads/common';
import { LeadRow, UpdateDialog } from '@/components/storeLeads/UpdateDialog';
import { todayInIndia } from '@/lib/storeLeads/clientDates';

interface Group extends Summary { label: string; posCode?: string; userId?: string }
interface Note { id: string; kind: string; posCode: string; storeName: string; customerName: string; requirement: string; dueAt: string; createdAt: string; readAt: string | null; readByName: string | null; answeredAt: string | null; assignedAt: string }
interface Listing {
  serverNow: string; range: { type: 'day' | 'month'; value: string }; total: number; truncated: boolean; summary: Summary; byStore: Group[]; bySales: Group[];
  waitingNow: { total: number; over20: number; over40: number; leads: { id: string; posCode: string; storeName: string; customerName: string; minutes: number; level: number }[] };
  filters: { stores: { posCode: string; label: string; count: number }[]; sales: { id: string; label: string; count: number }[] };
  notifications: Note[]; leads: LeadRow[];
}
const FILTERS: [string, string][] = [['', 'All'], ['NEW', 'Awaiting response'], ['WAITING20', 'Waiting 20+ min'], ['WAITING40', 'Waiting 40+ min'], ['FOLLOW_UP', 'In follow-up'], ['OVERDUE', 'Overdue follow-up'], ['CLOSED', 'Closed'], ['NOT_CLOSED', 'Not Closed'], ['NOT_INTERESTED', 'Not Interested']];
const csvCell = (v: unknown) => { const t = String(v ?? '').replace(/\s*\n\s*/g, ' / '); return /[",]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };

function GroupTable({ title, rows, firstCol }: { title: string; rows: Group[]; firstCol: string }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/10">
        <table className="w-full min-w-[640px] text-xs">
          <thead><tr className="bg-gray-50 text-left text-[10.5px] uppercase tracking-wide text-gray-500 dark:bg-white/5"><th className="px-3 py-2">{firstCol}</th><th className="px-3 py-2 text-right">Leads</th><th className="px-3 py-2 text-right">Closed</th><th className="px-3 py-2 text-right">Not Closed</th><th className="px-3 py-2 text-right">Not Interested</th><th className="px-3 py-2 text-right">Awaiting</th><th className="px-3 py-2 text-right">20+ min</th><th className="px-3 py-2 text-right">40+ min</th><th className="px-3 py-2 text-right">Overdue</th><th className="px-3 py-2 text-right">Conversion</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.posCode ?? r.userId ?? r.label} className="border-t border-gray-100 dark:border-white/10">
              <td className="px-3 py-2 font-semibold">{r.label}</td><td className="px-3 py-2 text-right font-mono">{r.total}</td><td className="px-3 py-2 text-right font-mono">{r.closed}</td><td className="px-3 py-2 text-right font-mono">{r.notClosed}</td><td className="px-3 py-2 text-right font-mono">{r.notInterested}</td>
              <td className={`px-3 py-2 text-right font-mono ${r.pendingFirstResponse ? 'font-bold text-red-600' : ''}`}>{r.pendingFirstResponse}</td><td className={`px-3 py-2 text-right font-mono ${r.pendingOver20 ? 'font-bold text-red-600' : ''}`}>{r.pendingOver20}</td><td className={`px-3 py-2 text-right font-mono ${r.pendingOver40 ? 'font-bold text-red-600' : ''}`}>{r.pendingOver40}</td>
              <td className={`px-3 py-2 text-right font-mono ${r.overdueFollowUps ? 'font-bold text-amber-600' : ''}`}>{r.overdueFollowUps}</td><td className="px-3 py-2 text-right font-mono font-bold">{r.conversionPercent}%</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminStoreLeadsPage() {
  const today = useMemo(() => todayInIndia(), []);
  const [period, setPeriod] = useState(`month=${today.slice(0, 7)}`);
  const [posCode, setPosCode] = useState('');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<{ text: string; missing: boolean } | null>(null);
  const [open, setOpen] = useState<LeadRow | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = [period, posCode && `posCode=${encodeURIComponent(posCode)}`, userId && `userId=${encodeURIComponent(userId)}`, status && `status=${status}`].filter(Boolean).join('&');
      const res = await fetch(`/api/admin/store-leads?${qs}`);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(b.error || 'The store leads could not be loaded.'), { missing: !!b.tableMissing });
      setData(b);
      setError(null);
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : 'The store leads could not be loaded.', missing: !!(e as { missing?: boolean }).missing });
    }
  }, [period, posCode, userId, status]);
  useEffect(() => {
    load();
  }, [load]);
  usePolling(load, 45_000);

  const exportCsv = () => {
    if (!data) return;
    const head = ['Received', 'Store', 'POS code', 'Shared by', 'Customer', 'Mobile', 'Requirement', 'Initial remarks', 'Interest', 'Visit', 'Status', 'First response', 'Latest follow-up remark', 'Billed name', 'Billed mobile'];
    const lines = data.leads.map((l) => [fmtDateTime(l.assignedAt), l.storeName, l.posCode, l.sharedByName, l.customerName, l.customerMobile, l.requirement, l.remarks, l.interest, l.visitIntention, l.statusLabel, l.firstResponseAt ? fmtDateTime(l.firstResponseAt) : '', l.lastRemark, l.billedName, l.billedMobile].map(csvCell).join(','));
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Store_Leads_${data.range.value}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const s = data?.summary;
  const w = data?.waitingNow;
  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-pal-bar-dark/90 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" aria-label="Back to admin" className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-zinc-800 dark:text-gray-300"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="flex items-center gap-2 truncate text-lg font-extrabold text-gray-950 dark:text-white"><Inbox className="h-5 w-5 shrink-0 text-blue-600" /> Store leads</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/store-accounts" className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-200"><KeyRound className="h-3.5 w-3.5" /><span className="hidden sm:inline">Store accounts</span></Link>
            <button type="button" onClick={exportCsv} disabled={!data} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-blue-600 disabled:opacity-50 dark:bg-zinc-800 dark:text-gray-200"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">CSV</span></button>
            <Link href="/" aria-label="Home" title="Home" className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-300"><Home className="h-4 w-4" /></Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8 2xl:px-12">
        <section className="space-y-3 rounded-3xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-pal-card-dark">
          <div className="flex flex-wrap items-center gap-3">
            <PeriodPicker value={period} onChange={setPeriod} today={today} allowAll />
            <select value={posCode} onChange={(e) => setPosCode(e.target.value)} aria-label="Filter by store" className={`${fieldCls} w-auto`}><option value="">All stores</option>{data?.filters.stores.map((x) => <option key={x.posCode} value={x.posCode}>{x.label} ({x.count})</option>)}</select>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Filter by CEC user" className={`${fieldCls} w-auto`}><option value="">All sales users</option>{data?.filters.sales.map((x) => <option key={x.id} value={x.id}>{x.label} ({x.count})</option>)}</select>
          </div>
          <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
            {FILTERS.map(([k, label]) => <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)} className={`rounded-full border px-3 py-1 text-xs font-bold transition ${status === k ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300 dark:border-white/10 dark:text-gray-300'}`}>{label}</button>)}
          </div>
        </section>

        {error ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error.text}</p></div>
        ) : !data ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> : (
          <>
            <section aria-label="Overall numbers" className="space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{periodLabel(data.range)}</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                <Stat label="Leads generated and distributed" value={s!.total} /><Stat label="Closed" value={s!.closed} tone={s!.closed ? 'good' : 'plain'} /><Stat label="Not Closed" value={s!.notClosed} /><Stat label="Not Interested" value={s!.notInterested} />
                <Stat label="Conversion" value={`${s!.conversionPercent}%`} tone={s!.closed ? 'good' : 'plain'} /><Stat label="Hot leads" value={s!.hot} /><Stat label="Overdue follow-ups" value={s!.overdueFollowUps} tone={s!.overdueFollowUps ? 'warn' : 'plain'} /><Stat label="No decision yet" value={s!.undecided} />
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:max-w-xl">
                <Stat label="Awaiting response now" value={w!.total} tone={w!.total ? 'bad' : 'plain'} hint="All dates, right now" /><Stat label="Waiting over 20 min" value={w!.over20} tone={w!.over20 ? 'bad' : 'plain'} /><Stat label="Waiting over 40 min" value={w!.over40} tone={w!.over40 ? 'bad' : 'plain'} />
              </div>
            </section>

            {w!.leads.length > 0 && (
              <section className="rounded-3xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800 dark:text-red-200"><BellRing className="h-4 w-4" /> Waiting for a store response right now</h2>
                <ul className="grid gap-1.5 text-xs sm:grid-cols-2 xl:grid-cols-3">
                  {w!.leads.map((l) => <li key={l.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${l.level === 2 ? 'bg-red-600 text-white' : 'bg-white dark:bg-white/5'}`}><span className="min-w-0 truncate"><strong>{l.posCode}</strong> · {l.customerName}</span><span className="shrink-0 font-bold">{fmtWait(l.minutes)}</span></li>)}
                </ul>
              </section>
            )}

            <section className="space-y-5 rounded-3xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-pal-card-dark">
              <GroupTable title="Store-wise distribution and conversion" rows={data.byStore} firstCol="Store" />
              <GroupTable title="CEC-user-wise distribution" rows={data.bySales} firstCol="CEC user" />
            </section>

            <section className="space-y-2 rounded-3xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-pal-card-dark">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Leads <span className="font-normal text-gray-500">· {data.total}{data.truncated ? ' (first 3,000 shown)' : ''}</span></h2>
              {data.leads.length === 0 ? <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/15">No leads match these filters.</p> : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/10">
                  <table className="w-full min-w-[900px] text-xs">
                    <thead><tr className="bg-gray-50 text-left text-[10.5px] uppercase tracking-wide text-gray-500 dark:bg-white/5"><th className="px-3 py-2">Received</th><th className="px-3 py-2">Store</th><th className="px-3 py-2">Shared by</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Requirement</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Billed customer</th><th className="px-3 py-2" /></tr></thead>
                    <tbody>{data.leads.map((l) => (
                      <tr key={l.id} className={`border-t border-gray-100 align-top dark:border-white/10 ${l.conversion === 'CLOSED' ? 'lead-closed' : l.reminderLevel === 2 ? 'lead-pulse-2' : l.reminderLevel === 1 ? 'lead-pulse-1' : ''}`}>
                        <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(l.assignedAt)}</td><td className="px-3 py-2"><strong>{l.posCode}</strong><br /><span className="text-gray-500">{l.storeName}</span></td><td className="px-3 py-2">{l.sharedByName}</td>
                        <td className="px-3 py-2"><strong>{l.customerName}</strong><br /><span className="font-mono text-gray-500">{fmtMobile(l.customerMobile)}</span></td><td className="px-3 py-2">{l.requirement}</td>
                        <td className="space-y-1 px-3 py-2"><StatusBadge status={l.status} /><div><InterestPill value={l.interest} /></div>{l.minutesWaiting !== null && l.reminderLevel > 0 && <p className="font-bold text-red-600">Waiting {fmtWait(l.minutesWaiting)}</p>}{l.overdueFollowUp && <p className="font-bold text-amber-600">Overdue follow-up</p>}</td>
                        <td className="px-3 py-2">{l.billedName ? <>{l.billedName}<br /><span className="font-mono text-gray-500">{l.billedMobile ? fmtMobile(l.billedMobile) : ''}</span></> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2"><button type="button" onClick={() => setOpen(l)} className="rounded-lg bg-blue-50 px-2.5 py-1 font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300">History</button></td>
                      </tr>))}</tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-2 rounded-3xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-pal-card-dark">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Reminder history <span className="font-normal text-gray-500">· {data.notifications.length}</span></h2>
              {data.notifications.length === 0 ? <p className="text-xs text-gray-500">No reminders fell due in this period.</p> : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/10">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead><tr className="bg-gray-50 text-left text-[10.5px] uppercase tracking-wide text-gray-500 dark:bg-white/5"><th className="px-3 py-2">Reminder</th><th className="px-3 py-2">Store</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Lead received</th><th className="px-3 py-2">Fell due</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Acknowledged</th><th className="px-3 py-2">Store responded</th></tr></thead>
                    <tbody>{data.notifications.map((n) => (
                      <tr key={n.id} className="border-t border-gray-100 dark:border-white/10"><td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${n.kind === 'REMINDER_40' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200'}`}>{n.kind === 'REMINDER_40' ? '40 min' : '20 min'}</span></td><td className="px-3 py-2">{n.posCode} · {n.storeName}</td><td className="px-3 py-2">{n.customerName}</td><td className="whitespace-nowrap px-3 py-2">{fmtDateTime(n.assignedAt)}</td><td className="whitespace-nowrap px-3 py-2">{fmtDateTime(n.dueAt)}</td><td className="whitespace-nowrap px-3 py-2">{fmtDateTime(n.createdAt)}</td><td className="whitespace-nowrap px-3 py-2">{n.readAt ? `${fmtDateTime(n.readAt)}${n.readByName ? ` · ${n.readByName}` : ''}` : <span className="text-gray-300">Not yet</span>}</td><td className="whitespace-nowrap px-3 py-2">{n.answeredAt ? fmtDateTime(n.answeredAt) : <span className="font-bold text-red-600">No response</span>}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {open && <UpdateDialog lead={open} apiBase="/api/store/leads" historyBase="/api/admin/store-leads" isAdmin onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
    </div>
  );
}
