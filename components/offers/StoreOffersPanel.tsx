'use client';

import React from 'react';
import { Tag } from 'lucide-react';
import { DeviceSearch } from '@/components/offers/DeviceSearch';
import { useOffers } from '@/components/offers/OffersContext';
import { OfferLoadError, OfferLoading, OfferMessage, OfferShell } from '@/components/offers/OfferShell';
import { formatDay } from '@/lib/offers/dates';
import { groupStoreOffers, storeValueLabel, uniqueTerms } from '@/lib/offers/present';
import type { StoreOfferData } from '@/lib/offers/types';

/** Dates are shown only when the sheet has them; an offer with neither date shows no validity line. */
function validity(o: { validFrom: string | null; validUntil: string | null }): string | null {
  if (o.validFrom && o.validUntil) return `${formatDay(o.validFrom)} – ${formatDay(o.validUntil)}`;
  if (o.validFrom) return `From ${formatDay(o.validFrom)}`;
  if (o.validUntil) return `Until ${formatDay(o.validUntil)}`;
  return null;
}

function OfferRow({ o }: { o: StoreOfferData }) {
  const value = storeValueLabel(o);
  const heading = o.tradeIn ?? o.offerType;
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white/80 px-3.5 py-3 dark:border-white/10 dark:bg-zinc-900/50">
      {value && (
        <span className="shrink-0 rounded-xl bg-amber-100 px-2.5 py-1.5 text-sm font-extrabold leading-tight text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{value}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-950 dark:text-white">{heading}</p>
        <p className="text-xs text-gray-600 dark:text-gray-300">{o.offerText}</p>
        {validity(o) && <p className="mt-0.5 text-[11px] text-gray-400">{validity(o)}</p>}
      </div>
    </li>
  );
}

export function StoreOffersPanel() {
  const { device, load, reload } = useOffers();
  const data = load.status === 'ready' ? load.data : null;
  const groups = data ? groupStoreOffers(data.store) : [];
  const terms = data ? uniqueTerms(data.store) : [];

  return (
    <OfferShell title="Store Offers" icon={<Tag className="h-4 w-4" />}>
      <DeviceSearch />

      <div className="mt-3">
        {load.status === 'error' ? (
          <OfferLoadError message={load.message} onRetry={reload} />
        ) : load.status === 'loading' && device ? (
          <OfferLoading />
        ) : !device ? (
          <OfferMessage>Search a device above to see its store offers.</OfferMessage>
        ) : data && !data.hasData ? (
          <OfferMessage tone="warn">Offers haven’t been loaded yet. Ask an administrator to import the offer file.</OfferMessage>
        ) : data && data.store.length === 0 ? (
          <OfferMessage>
            {data.upcoming.store ? `Store offers for this product start on ${formatDay(data.upcoming.store)}.` : 'No active store offer available for this product.'}
          </OfferMessage>
        ) : (
          <div className="space-y-3">
            {groups.map((g, i) => (
              <div key={g.title ?? i}>
                {g.title && <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-gray-500 dark:text-gray-400">{g.title}</p>}
                <ul className="space-y-2">
                  {g.rows.map((o) => (
                    <OfferRow key={o.offerId} o={o} />
                  ))}
                </ul>
              </div>
            ))}
            {terms.length > 0 && (
              <details className="text-xs text-gray-500 dark:text-gray-400">
                <summary className="cursor-pointer font-semibold">Terms and conditions</summary>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  {terms.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </OfferShell>
  );
}
