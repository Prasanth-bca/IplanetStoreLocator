'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, BellRing, CheckCircle2, Clock, Home, Inbox, Loader2, LogOut, Phone, Search, Store as StoreIcon, Trophy } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { resetCurrentUser, useCurrentUser } from '@/lib/useCurrentUser';
import { reminderLevel, type Summary } from '@/lib/storeLeads/rules';
import { Confetti } from '@/components/storeLeads/Confetti';
import { fieldCls, fmtDateTime, fmtMobile, fmtWait, InterestPill, PeriodPicker, periodLabel, Stat, StatusBadge, usePolling, useServerClock, VisitText } from '@/components/storeLeads/common';
import { LeadRow, UpdateDialog } from '@/components/storeLeads/UpdateDialog';
import { todayInIndia } from '@/lib/storeLeads/clientDates';

interface Listing {
  serverNow: string;
  range: { type: 'day' | 'month'; value: string };
  posCode: string;
  store: { posCode: string; storeName: string; city: string } | null;
  total: number;
  truncated: boolean;
  summary: Summary;
  pending: { total: number; over20: number; over40: number; longestWaitMinutes: number };
  leads: LeadRow[];
}

const FILTERS: [string, string][] = [['', 'All'], ['NEW', 'Awaiting response'], ['FOLLOW_UP', 'In follow-up'], ['OVERDUE', 'Overdue follow-up'], ['CLOSED', 'Closed'], ['NOT_CLOSED', 'Not Closed'], ['NOT_INTERESTED', 'Not Interested']];
const GRID = 'md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_auto]';

export default function ReceivedLeadsPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const today = useMemo(() => todayInIndia(), []);
  const [period, setPeriod] = useState(`month=${today.slice(0, 7)}`);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<{ text: string; missing: boolean } | null>(null);
  const [open, setOpen] = useState<LeadRow | null>(null);
  const [celebrate, setCelebrate] = useState<{ name: string; n: number } | null>(null);
  const [confetti, setConfetti] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const now = useServerClock(data?.serverNow ?? null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/store/leads?${period}${status ? `&status=${status}` : ''}`);
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(b.error || 'The received leads could not be loaded.'), { missing: !!b.tableMissing });
      setData(b);
      setError(null);
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : 'The received leads could not be loaded.', missing: !!(e as { missing?: boolean }).missing });
    }
  }, [period, status]);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') load();
  }, [load, user]);
  usePolling(() => user && user.role !== 'ADMIN' && load(), 30_000);

  // A reminder's "Open lead" button links here with ?lead=<id>.
  useEffect(() => {
    if (!data) return;
    const id = new URLSearchParams(window.location.search).get('lead');
    const hit = id ? data.leads.find((l) => l.id === id) : null;
    if (hit) {
      setOpen(hit);
      window.history.replaceState(null, '', '/store-leads');
    }
  }, [data]);

  const logout = async () => {
    setLeaving(true);
    await fetch('/api/logout', { method: 'POST' });
    resetCurrentUser();
    router.push('/login');
    router.refresh();
  };

  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (data?.leads ?? []).filter((l) => !words.length || words.every((w) => `${l.customerName} ${l.customerMobile} ${l.requirement}`.toLowerCase().includes(w)));
  }, [data, q]);

  const level = (l: LeadRow) => reminderLevel({ assignedAt: new Date(l.assignedAt), firstResponseAt: l.firstResponseAt ? new Date(l.firstResponseAt) : null, conversion: l.conversion }, now());
  const waited = (l: LeadRow) => Math.max(0, Math.floor((now().getTime() - new Date(l.assignedAt).getTime()) / 60000));

  if (!userLoading && user?.role === 'ADMIN') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm text-gray-700 dark:text-gray-200">Store logins use this page. As an admin, you can see every store’s leads and reports on the admin page.</p>
        <Link href="/admin/store-leads" className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">Open store leads (admin)</Link>
      </div>
    );
  }

  const s = data?.summary;
  const p = data?.pending;

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-pal-bar-dark/90 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Inbox className="h-5 w-5 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-extrabold leading-tight text-gray-950 dark:text-white">Received Leads</h1>
              <p className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400"><StoreIcon className="h-3 w-3" />{data?.store ? `${data.store.storeName} · ${data.store.posCode}` : user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {p && p.total > 0 && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${p.over40 > 0 ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200'}`}>
                <BellRing className="h-3.5 w-3.5" /> {p.total} awaiting response
              </span>
            )}
            <Link href="/" aria-label="Home" title="Home" className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-300"><Home className="h-4 w-4" /></Link>
            <button type="button" onClick={logout} disabled={leaving} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-red-600 dark:bg-zinc-800 dark:text-gray-200"><LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Logout</span></button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8 2xl:px-12">
        {error ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error.text}</p></div>
        ) : !data ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {p && p.over40 > 0 && (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white"><BellRing className="mt-0.5 h-4 w-4 shrink-0" />{p.over40} lead{p.over40 === 1 ? ' has' : 's have'} been waiting for a response for 40 minutes or more (the longest {fmtWait(p.longestWaitMinutes)}). Please follow up now.</p>
            )}

            <section aria-label="Report" className="space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Report for {periodLabel(data.range)}</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Leads received" value={s!.total} />
                <Stat label="Awaiting first response" value={p!.total} tone={p!.total ? 'bad' : 'plain'} hint="All dates" />
                <Stat label="Waiting over 20 min" value={p!.over20} tone={p!.over20 ? 'bad' : 'plain'} />
                <Stat label="Waiting over 40 min" value={p!.over40} tone={p!.over40 ? 'bad' : 'plain'} />
                <Stat label="Overdue follow-ups" value={s!.overdueFollowUps} tone={s!.overdueFollowUps ? 'warn' : 'plain'} />
                <Stat label="Conversion" value={`${s!.conversionPercent}%`} tone={s!.closed ? 'good' : 'plain'} hint="Closed as a share of leads received" />
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                <Stat label="Hot" value={s!.hot} /><Stat label="Warm" value={s!.warm} /><Stat label="Cold" value={s!.cold} />
                <Stat label="Visit today" value={s!.visitToday} /><Stat label="Visit tomorrow" value={s!.visitTomorrow} /><Stat label="Visit later" value={s!.visitLater} />
                <Stat label="Closed" value={s!.closed} tone={s!.closed ? 'good' : 'plain'} /><Stat label="Not Closed" value={s!.notClosed} />
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8"><Stat label="Not Interested" value={s!.notInterested} /><Stat label="No decision yet" value={s!.undecided} /></div>
            </section>

            <section className="space-y-3 rounded-3xl border border-gray-200/80 bg-white p-4 dark:border-white/10 dark:bg-pal-card-dark">
              <div className="flex flex-wrap items-center gap-3">
                <PeriodPicker value={period} onChange={setPeriod} today={today} />
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number or product" aria-label="Search leads" className={`${fieldCls} pl-9`} />
                </div>
              </div>
              <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
                {FILTERS.map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)} className={`rounded-full border px-3 py-1 text-xs font-bold transition ${status === k ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300 dark:border-white/10 dark:text-gray-300'}`}>{label}</button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">Leads still waiting for a first response are always shown, from any date, so none can be missed.</p>
            </section>

            {rows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-white/60 px-4 py-14 text-center dark:border-white/15 dark:bg-white/5">
                <Inbox className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{q || status ? 'No leads match these filters.' : 'No leads received in this period yet.'}</p>
                <p className="mt-1 text-xs text-gray-500">New leads from the sales team appear here automatically.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white dark:border-white/10 dark:bg-pal-card-dark">
                <div className={`hidden gap-3 border-b border-gray-100 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-500 dark:border-white/10 md:grid ${GRID}`}>
                  <span>Customer</span><span>Contact number</span><span>Product requirement</span><span>Received</span><span>Initial remarks</span><span>Follow-up remarks</span><span>Status</span><span className="w-20" />
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-white/5">
                  {rows.map((l) => {
                    const lv = level(l);
                    const closed = l.conversion === 'CLOSED';
                    return (
                      <li key={l.id} data-level={lv} className={`grid grid-cols-1 items-start gap-x-3 gap-y-1.5 px-4 py-3 text-sm ${GRID} ${closed ? 'lead-closed' : lv === 2 ? 'lead-pulse-2' : lv === 1 ? 'lead-pulse-1' : ''}`}>
                        <div className="min-w-0"><p className="truncate font-bold text-gray-950 dark:text-white">{l.customerName}</p><div className="mt-1 flex flex-wrap items-center gap-1.5"><InterestPill value={l.interest} /></div></div>
                        <a href={`tel:${l.customerMobile}`} className="inline-flex items-center gap-1 font-mono text-[13px] font-semibold text-blue-700 dark:text-blue-300"><Phone className="h-3 w-3 md:hidden" />{fmtMobile(l.customerMobile)}</a>
                        <p className="min-w-0 break-words font-medium text-gray-800 dark:text-gray-100">{l.requirement}</p>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          <p>{fmtDateTime(l.assignedAt)}</p>
                          {!l.firstResponseAt && !l.conversion ? (
                            <p className={`mt-0.5 inline-flex items-center gap-1 font-bold ${lv ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}><Clock className="h-3 w-3" />{lv === 2 ? `Pending ${fmtWait(waited(l))}, no response` : lv === 1 ? `Awaiting response ${fmtWait(waited(l))}` : `Waiting ${fmtWait(waited(l))}`}</p>
                          ) : null}
                        </div>
                        <p className="min-w-0 whitespace-pre-wrap break-words text-xs text-gray-600 dark:text-gray-300">{l.remarks || <span className="text-gray-300">None</span>}</p>
                        <p className="min-w-0 whitespace-pre-wrap break-words text-xs text-gray-700 dark:text-gray-200">{l.lastRemark || <span className="text-gray-300">No follow-up yet</span>}</p>
                        <div className="space-y-1"><StatusBadge status={l.status} /><div><VisitText value={l.visitIntention} /></div>{l.overdueFollowUp && <p className="text-[11px] font-bold text-amber-600">Follow-up overdue</p>}{closed && l.billedName && <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Billed: {l.billedName}</p>}</div>
                        <button type="button" onClick={() => setOpen(l)} className="w-full rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 md:w-20">{l.firstResponseAt || l.conversion ? 'Update' : 'Respond'}</button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <p className="text-center text-[11px] text-gray-400">Showing {rows.length} lead{rows.length === 1 ? '' : 's'}. Updates automatically every 30 seconds.</p>
          </>
        )}
      </main>

      {open && (
        <UpdateDialog
          lead={open}
          apiBase="/api/store/leads"
          isAdmin={false}
          onClose={() => setOpen(null)}
          onSaved={(lead, won) => {
            setOpen(null);
            if (won) {
              setCelebrate({ name: lead.customerName, n: Date.now() });
              setConfetti(true);
            }
            load();
          }}
        />
      )}

      {confetti && <Confetti onDone={() => setConfetti(false)} />}
      {celebrate && (
        <div key={celebrate.n} role="status" onAnimationEnd={() => setCelebrate(null)} className="lead-celebrate pointer-events-none fixed left-1/2 top-20 z-[110] w-[min(92vw,420px)] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-600 px-5 py-4 text-white shadow-2xl">
            <Trophy className="h-8 w-8 shrink-0" />
            <div><p className="text-base font-extrabold leading-tight">Congratulations! Lead Successfully Converted!</p><p className="mt-0.5 text-xs text-emerald-50"><CheckCircle2 className="mr-1 inline h-3 w-3" />{celebrate.name} is now a billed customer.</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
