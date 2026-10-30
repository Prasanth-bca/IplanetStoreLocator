'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { OffersResponse } from '@/lib/offers/types';

/** The one device both offer panels, the device search and the stock list agree on. */
export interface SelectedDevice {
  sku: string;
  name: string;
  variant: string | null;
  category: string | null;
}

export type OffersLoad =
  | { status: 'loading' }
  | { status: 'ready'; data: OffersResponse }
  | { status: 'error'; message: string };

interface OffersContextValue {
  device: SelectedDevice | null;
  selectDevice: (d: SelectedDevice | null) => void;
  load: OffersLoad;
  reload: () => void;
}

const OffersContext = createContext<OffersContextValue | null>(null);

export function OffersProvider({ children }: { children: React.ReactNode }) {
  const [device, setDevice] = useState<SelectedDevice | null>(null);
  const [load, setLoad] = useState<OffersLoad>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const sku = device?.sku ?? null;

  // Fetch whenever the selected device changes (and once with no device, for the campaign label).
  // Both panels read this one result, so a change refreshes them together with a single request.
  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });
    fetch(sku ? `/api/offers?sku=${encodeURIComponent(sku)}` : '/api/offers')
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Offer data could not be loaded.');
        if (!cancelled) setLoad({ status: 'ready', data: body as OffersResponse });
      })
      .catch((e) => !cancelled && setLoad({ status: 'error', message: e instanceof Error ? e.message : 'Offer data could not be loaded.' }));
    return () => {
      cancelled = true;
    };
  }, [sku, reloadKey]);

  const selectDevice = useCallback((d: SelectedDevice | null) => setDevice(d), []);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const value = useMemo(() => ({ device, selectDevice, load, reload }), [device, selectDevice, load, reload]);

  return <OffersContext.Provider value={value}>{children}</OffersContext.Provider>;
}

export function useOffers(): OffersContextValue {
  const ctx = useContext(OffersContext);
  if (!ctx) throw new Error('useOffers must be used inside <OffersProvider>');
  return ctx;
}

/** For components that also live on pages without offer panels (such as the stock list on /stock). */
export const useOffersOptional = () => useContext(OffersContext);
