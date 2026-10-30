'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useOffers } from '@/components/offers/OffersContext';
import { formatUpdated, OfferLoadError, OfferLoading, OfferMessage, OfferShell } from '@/components/offers/OfferShell';
import { deviceLabel } from '@/components/offers/DeviceSearch';
import { formatDay } from '@/lib/offers/dates';
import { BANK_GROUPS, BankGroup, bankFilterCounts, formatInr, groupBankOffers, uniqueTerms } from '@/lib/offers/present';

const chip = (active: boolean, disabled: boolean) =>
  `rounded-full border px-3 py-1 text-xs font-semibold transition ${
    active
      ? 'border-blue-600 bg-blue-600 text-white'
      : disabled
      ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600'
      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-300'
  }`;

export function BankOffersPanel() {
  const { device, load, reload } = useOffers();
  const [filter, setFilter] = useState<BankGroup | 'All'>('All');
  const data = load.status === 'ready' ? load.data : null;

  // A filter picked for one device must not silently hide everything for the next.
  useEffect(() => setFilter('All'), [device?.sku]);

  const counts = useMemo(() => (data ? bankFilterCounts(data.bank) : null), [data]);
  const sections = useMemo(() => (data ? groupBankOffers(data.bank, filter) : []), [data, filter]);
  const terms = data ? uniqueTerms(data.bank) : [];

  return (
    <OfferShell title="Bank Offers" icon={<CreditCard className="h-4 w-4" />}>
      {device && <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">For <strong className="font-bold text-gray-900 dark:text-white">{deviceLabel(device)}</strong></p>}

      {load.status === 'error' ? (
        <OfferLoadError message={load.message} onRetry={reload} />
      ) : load.status === 'loading' && device ? (
        <OfferLoading />
      ) : !device ? (
        <OfferMessage>Pick a device in the Store Offers search to see eligible bank offers.</OfferMessage>
      ) : data && !data.hasData ? (
        <OfferMessage tone="warn">Offers haven’t been loaded yet. Ask an administrator to import the offer file.</OfferMessage>
      ) : data && data.bank.length === 0 ? (
        <OfferMessage>{data.upcoming.bank ? `Bank offers for this product start on ${formatDay(data.upcoming.bank)}.` : 'No active bank offer available for this product.'}</OfferMessage>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by bank">
            <button type="button" onClick={() => setFilter('All')} aria-pressed={filter === 'All'} className={chip(filter === 'All', false)}>
              All
            </button>
            {BANK_GROUPS.map((g) => {
              const n = counts?.[g] ?? 0;
              return (
                <button key={g} type="button" disabled={n === 0} onClick={() => setFilter(g)} aria-pressed={filter === g} className={chip(filter === g, n === 0)}>
                  {g}
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            {sections.map((s) => (
              <div key={s.key}>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">{s.title}</p>
                {s.note && <p className="mb-1.5 text-[11px] text-gray-400">{s.note}</p>}
                <ul className="mt-1.5 space-y-2">
                  {s.items.map((it) => (
                    <li key={it.key} className="rounded-2xl border border-gray-100 bg-white/80 px-3.5 py-3 dark:border-white/10 dark:bg-zinc-900/50">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-sm font-bold text-gray-950 dark:text-white">{it.label}</p>
                        {it.amount !== null && s.key !== 'instalment' && s.key !== 'loan' && (
                          <span className="shrink-0 rounded-xl bg-blue-50 px-2.5 py-1 text-sm font-extrabold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{formatInr(it.amount)}</span>
                        )}
                      </div>
                      {it.details && <p className="mt-1 whitespace-pre-line text-xs text-gray-600 dark:text-gray-300">{it.details}</p>}
                      <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">{it.banks.join(' · ')}</p>
                      {(it.validFrom || it.validUntil) && (
                        <p className="text-[11px] text-gray-400">
                          {it.validFrom && it.validUntil ? `Valid ${formatDay(it.validFrom)} – ${formatDay(it.validUntil)}` : it.validFrom ? `From ${formatDay(it.validFrom)}` : `Until ${formatDay(it.validUntil!)}`}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {sections.length === 0 && <OfferMessage>No {filter} offer for this product. Choose another bank filter.</OfferMessage>}
          </div>

          <p className="mt-3 text-[11px] text-gray-400">Store and bank offers can be combined. They are shown separately.</p>
          {terms.length > 0 && (
            <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer font-semibold">Terms and conditions</summary>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                {terms.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {data?.lastUpdated && <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] text-gray-400 dark:border-white/10">Offer data last updated {formatUpdated(data.lastUpdated)}</p>}
    </OfferShell>
  );
}
