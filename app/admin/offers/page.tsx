'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle, Download, FileSpreadsheet, Home, Loader2, Tag, Upload } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatUpdated } from '@/components/offers/OfferShell';
import { formatDay } from '@/lib/offers/dates';

interface Tally {
  total: number;
  active: number;
  upcoming: number;
  expired: number;
  inactive: number;
}
interface Status {
  today: string;
  lastImport: { importedAt: string; fileName: string; importedByName: string | null } | null;
  store: Tally;
  bank: Tally;
  campaigns: { name: string; label: string; theme: string; startDate: string; endDate: string; active: boolean }[];
  runningCampaign: string | null;
}
interface Issue {
  sheet: string;
  row?: number;
  message: string;
}
interface CheckResult {
  ok: boolean;
  imported: boolean;
  mode: 'check' | 'import';
  summary: { storeOffers: number; bankRows: number; bankOffers: number; campaigns: { name: string; label: string; theme: string; startDate: string; endDate: string; active: boolean }[] };
  errors: Issue[];
  warnings: Issue[];
  unmatched: string[];
}

const TallyLine = ({ t }: { t: Tally }) => (
  <p className="text-xs text-gray-500 dark:text-gray-400">
    <strong className="text-gray-900 dark:text-white">{t.active}</strong> live now · {t.upcoming} starting later · {t.expired} ended · {t.inactive} inactive
  </p>
);

export default function OffersAdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'check' | 'import' | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/offers/status');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not load offer status');
      setStatus(body);
      setStatusError(null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Could not load offer status');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const send = async (f: File, mode: 'check' | 'import') => {
    setBusy(mode);
    setFailure(null);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('mode', mode);
      const res = await fetch('/api/admin/offers/import', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'The file could not be processed.');
      setResult(body);
      if (body.imported) await loadStatus();
    } catch (e) {
      setResult(null);
      setFailure(e instanceof Error ? e.message : 'The file could not be processed.');
    } finally {
      setBusy(null);
    }
  };

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    send(f, 'check'); // check straight away so problems show before anything is changed
  };

  const doImport = () => {
    if (!file || !result?.ok) return;
    if (!window.confirm('This replaces ALL current store offers, bank offers and campaigns with the contents of this file. Continue?')) return;
    send(file, 'import');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0b26] pb-16">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-[#121030]/90 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" aria-label="Back to admin" className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="flex items-center gap-2 truncate text-lg font-extrabold text-gray-950 dark:text-white">
              <Tag className="h-5 w-5 shrink-0 text-amber-600" /> Offers
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Home" title="Home" className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-300">
              <Home className="h-4 w-4" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8 2xl:px-12">
        {/* Current data */}
        <section className="space-y-3 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-[#1A1740]">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Current offer data</h2>
          {statusError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Offer data couldn’t be loaded.</strong> {statusError} If this is the first time, the offer tables may not exist in the database yet. See{' '}
                  <code className="rounded bg-white/70 px-1 dark:bg-black/30">prisma/manual/offers_tables.sql</code> for the one command that creates them.
                </span>
              </p>
            </div>
          ) : !status ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {status.lastImport ? (
                  <>
                    Last imported <strong>{formatUpdated(status.lastImport.importedAt)}</strong> from <span className="font-mono text-xs">{status.lastImport.fileName}</span>
                    {status.lastImport.importedByName ? ` by ${status.lastImport.importedByName}` : ''}.
                  </>
                ) : (
                  <strong>No offers have been imported yet.</strong>
                )}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 px-4 py-3 dark:border-white/10">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Store offers · {status.store.total}</p>
                  <TallyLine t={status.store} />
                </div>
                <div className="rounded-2xl border border-gray-100 px-4 py-3 dark:border-white/10">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Bank offers · {status.bank.total}</p>
                  <TallyLine t={status.bank} />
                </div>
              </div>
              {status.campaigns.map((c) => (
                <p key={c.name} className="text-sm text-gray-600 dark:text-gray-300">
                  Campaign <strong>{c.name}</strong> ({c.label || 'no label'}, {c.theme} theme): {formatDay(c.startDate)} to {formatDay(c.endDate)}.{' '}
                  {status.runningCampaign === c.name ? (
                    <span className="font-bold text-emerald-600">Running now: the festive panels are showing.</span>
                  ) : c.startDate > status.today ? (
                    <span className="font-semibold text-amber-600">Starts later.</span>
                  ) : (
                    <span className="text-gray-400">Not running.</span>
                  )}
                </p>
              ))}
            </>
          )}
        </section>

        {/* Upload */}
        <section className="space-y-4 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-[#1A1740]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
              <Upload className="h-4 w-4 text-blue-600" /> Import the Offers Master (Excel)
            </h2>
            <div className="flex flex-wrap gap-2">
              <a href="/api/admin/offers/export" className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200/80 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-800/60 dark:bg-blue-950/60 dark:text-blue-300">
                <Download className="h-3.5 w-3.5" /> Download current offers
              </a>
              <a href="/api/admin/offers/export?blank=1" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300">
                <Download className="h-3.5 w-3.5" /> Blank template
              </a>
            </div>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
              dragging ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30' : 'border-gray-300 hover:border-blue-400 dark:border-white/15'
            }`}
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin text-blue-600" /> : <FileSpreadsheet className="h-6 w-6 text-gray-400" />}
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {busy === 'check' ? 'Checking the file…' : busy === 'import' ? 'Importing…' : file ? file.name : 'Drop the .xlsx here, or click to browse'}
            </span>
            <span className="text-xs text-gray-500">The file is checked first. Nothing changes until you press Import.</span>
            <input
              ref={input}
              type="file"
              accept=".xlsx"
              className="sr-only"
              disabled={busy !== null}
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>

          {failure && (
            <p role="alert" className="flex items-start gap-2 text-sm text-red-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {failure}
            </p>
          )}

          {result && (
            <div className="space-y-3">
              {result.imported ? (
                <p role="status" className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> Imported {result.summary.storeOffers} store offers and {result.summary.bankOffers} bank offers. The panels now use this data.
                </p>
              ) : result.ok ? (
                <p className="flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>The file is valid.</strong> It has {result.summary.storeOffers} store offers and {result.summary.bankRows} bank rows ({result.summary.bankOffers} offers once each bank is listed separately).
                  </span>
                </p>
              ) : (
                <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong>{result.errors.length} problem{result.errors.length === 1 ? '' : 's'} found. Nothing was imported.</strong> Fix them in Excel and choose the file again.
                  </span>
                </p>
              )}

              {result.summary.campaigns.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Campaign{result.summary.campaigns.length > 1 ? 's' : ''}: {result.summary.campaigns.map((c) => `${c.name} (${formatDay(c.startDate)} to ${formatDay(c.endDate)})`).join('; ')}
                </p>
              )}

              {result.errors.length > 0 && (
                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-red-200 p-3 text-xs dark:border-red-900/50">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-red-700 dark:text-red-300">
                      <span className="font-bold">{e.sheet}{e.row ? ` · row ${e.row}` : ''}:</span> {e.message}
                    </li>
                  ))}
                </ul>
              )}

              {result.warnings.length > 0 && (
                <ul className="space-y-1 rounded-2xl border border-amber-200 p-3 text-xs dark:border-amber-900/50">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-amber-800 dark:text-amber-200">
                      <span className="font-bold">{w.sheet}:</span> {w.message}
                    </li>
                  ))}
                </ul>
              )}

              {result.unmatched.length > 0 && (
                <details className="text-xs text-gray-500 dark:text-gray-400">
                  <summary className="cursor-pointer font-semibold">{result.unmatched.length} offer product(s) have no matching product in the catalogue yet (not a problem; they just can’t be reached by search until the product exists)</summary>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                    {result.unmatched.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </details>
              )}

              {result.ok && !result.imported && (
                <button
                  type="button"
                  onClick={doImport}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy === 'import' && <Loader2 className="h-4 w-4 animate-spin" />} Import {result.summary.storeOffers} store and {result.summary.bankOffers} bank offers
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
