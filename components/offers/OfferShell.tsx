'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useOffers } from '@/components/offers/OffersContext';

/** A small oil lamp. Decoration only, hidden from screen readers. */
export function DiyaIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 48" className={className} fill="none">
      <path d="M32 4c4 5 6 8 6 12a6 6 0 0 1-12 0c0-4 2-7 6-12Z" fill="#F59E0B" />
      <path d="M32 11c2 2.6 3 4.4 3 6.3a3 3 0 0 1-6 0c0-1.9 1-3.7 3-6.3Z" fill="#FDE68A" />
      <path d="M6 26h52c0 10-9 18-26 18S6 36 6 26Z" fill="#B45309" />
      <path d="M6 26h52" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
      <path d="M14 33c6 5 30 5 36 0" stroke="#FCD34D" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

function Sparkle({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" />
    </svg>
  );
}

/**
 * Frame shared by the Store Offers and Bank Offers panels. The festive look (gold border, warm glow, lamp and
 * sparkles) and the label appear only while a campaign is running; afterwards this is a plain panel again.
 */
export function OfferShell({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const { load } = useOffers();
  const campaign = load.status === 'ready' ? load.data.campaign : null;
  const festive = campaign?.theme === 'Diwali';
  const label = campaign?.label || null;

  return (
    <section
      aria-label={title}
      className={`relative overflow-hidden rounded-3xl border p-5 transition-colors ${
        festive
          ? 'border-amber-300/80 dark:border-amber-600/50 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-amber-950/40 dark:via-[#16161a] dark:to-orange-950/30 shadow-[0_8px_30px_-12px_rgba(217,119,6,0.45)]'
          : 'border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#16161a] shadow-sm'
      }`}
    >
      {festive && (
        <>
          <DiyaIcon className="pointer-events-none absolute -right-1 -top-1 h-12 w-16 opacity-90" />
          <Sparkle className="pointer-events-none absolute right-16 top-3 h-3 w-3 text-amber-400/80" />
          <Sparkle className="pointer-events-none absolute right-5 top-14 h-2.5 w-2.5 text-amber-300/70" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
        </>
      )}

      <div className="relative">
        <div className="mb-3 flex flex-wrap items-center gap-2 pr-16">
          <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-gray-950 dark:text-white">
            <span className={festive ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}>{icon}</span>
            {title}
          </h2>
          {label && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest ${
                festive ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-300'
              }`}
            >
              {label}
            </span>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

/** "No offer" and "could not load" are different situations and are worded differently. */
export function OfferMessage({ tone = 'neutral', children }: { tone?: 'neutral' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === 'warn'
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
          : 'border-dashed border-gray-300 bg-gray-50/60 text-gray-600 dark:border-white/15 dark:bg-zinc-900/40 dark:text-gray-300'
      }`}
    >
      {children}
    </div>
  );
}

export function OfferLoading() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading offers">
      {[0, 1].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100 dark:bg-zinc-800/70" />
      ))}
      <span className="sr-only">
        <Loader2 /> Loading offers
      </span>
    </div>
  );
}

export function OfferLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <OfferMessage tone="warn">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Offer data couldn’t be loaded.</strong> {message} This is not the same as “no offer”. Please try again.
        </span>
      </p>
      <button type="button" onClick={onRetry} className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700">
        Try again
      </button>
    </OfferMessage>
  );
}

/** "31 Oct 2026, 10:12 am IST" */
export function formatUpdated(iso: string): string {
  const t = new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  return `${t} IST`;
}
