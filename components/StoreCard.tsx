'use client';

import React, { useMemo } from 'react';
import { StoreSearchResult } from '@/types/store';
import {
  MapPin,
  Navigation,
  Clock,
  Phone,
  ExternalLink,
  Compass,
  Star,
  Hash,
  Car,
  Timer,
  Activity,
  MessageCircle,
} from 'lucide-react';

interface StoreCardProps {
  result: StoreSearchResult;
  isSelected?: boolean;
  onSelect?: () => void;
  index?: number;
}

/** Determine if the store is open right now (IST) */
function isOpenNow(openingTime: string | null, closingTime: string | null): boolean | null {
  if (!openingTime || !closingTime) return null;
  try {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentMins = ist.getHours() * 60 + ist.getMinutes();

    const parseTime = (t: string) => {
      // Accept: "10:00 AM", "09:30 PM", "10:00", "21:30"
      const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!m) return null;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const ampm = m[3]?.toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    };

    const open = parseTime(openingTime);
    const close = parseTime(closingTime);
    if (open === null || close === null) return null;
    return currentMins >= open && currentMins < close;
  } catch {
    return null;
  }
}

/** Format distance: 1.4 → "1.4 km", 0.8 → "800 m" */
function formatDistance(km: number | null): string {
  if (km === null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km} km`;
}

/** Traffic color class */
function trafficColor(level: string | null): string {
  if (!level) return 'text-gray-500';
  if (level.includes('Heavy')) return 'text-red-600';
  if (level.includes('Moderate')) return 'text-amber-600';
  return 'text-emerald-600';
}

/** WhatsApp click-to-chat URL */
function waUrl(phone: string | null, storeName: string): string {
  const num = (phone || '').replace(/\D/g, '');
  const msg = encodeURIComponent(`Hi, I'd like to visit the ${storeName}. Please share the store details.`);
  return num ? `https://wa.me/91${num.replace(/^91/, '')}?text=${msg}` : '';
}

export const StoreCard: React.FC<StoreCardProps> = ({ result, isSelected, onSelect, index = 0 }) => {
  const { store, isPreferred, rank, distanceKm, travelTimeMinutes, trafficLevel, howToReach, directionsUrl } = result;

  const openStatus = useMemo(() => isOpenNow(store.openingTime, store.closingTime), [store.openingTime, store.closingTime]);
  const whatsappUrl = waUrl(store.phone, store.storeName);
  const mapsOpenUrl = store.googleMapsUrl || directionsUrl;

  return (
    <article
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.()}
      aria-label={`${store.storeName} – POS ${store.posCode}`}
      className={`store-card p-5 sm:p-6 animate-fadeInUp`}
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: 'both',
        ...(isSelected
          ? { borderColor: '#0066cc', boxShadow: 'var(--shadow-selected)' }
          : {}),
      }}
    >
      {/* ── Header Row ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        {/* Left: Rank + Type badges */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {isPreferred ? (
              <span className="badge-preferred pill">
                <Star className="w-3 h-3 fill-current" />
                Preferred / Nearest
              </span>
            ) : (
              <span className="pill bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700">
                <Hash className="w-3 h-3" />
                {rank} Suggested
              </span>
            )}

            <span className="pill bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60">
              {store.storeType || 'iPlanet Retail'}
            </span>
          </div>

          {/* Open/Closed status */}
          {openStatus !== null && (
            <div className="flex items-center gap-1.5">
              {openStatus ? (
                <>
                  <span className="live-dot" />
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Open Now</span>
                </>
              ) : (
                <>
                  <span className="w-[7px] h-[7px] rounded-full bg-red-400 inline-block" />
                  <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">Closed</span>
                </>
              )}
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                · {store.openingTime} – {store.closingTime}
              </span>
            </div>
          )}
        </div>

        {/* Right: POS Code */}
        <div className="text-right shrink-0">
          <div className="text-[9px] uppercase tracking-widest text-gray-500 dark:text-gray-400 font-bold mb-0.5">POS Code</div>
          <div className="font-mono font-extrabold text-lg text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-zinc-700 leading-none">
            {store.posCode}
          </div>
        </div>
      </div>

      {/* ── Store Name ── */}
      <h3 className="text-[18px] sm:text-xl font-extrabold text-gray-950 dark:text-white mb-1.5 leading-snug tracking-tight">
        {store.storeName}
      </h3>

      {/* ── Address ── */}
      <div className="flex items-start gap-2 mb-3">
        <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">{store.address}</p>
      </div>

      {/* ── Landmark ── */}
      {store.landmark && (
        <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-zinc-800/60 py-2 px-3 rounded-xl border border-gray-100 dark:border-zinc-700/60">
          <Compass className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
          <span>
            <strong className="text-gray-700 dark:text-gray-300 font-semibold">Landmark:</strong> {store.landmark}
          </span>
        </div>
      )}

      {/* ── Distance / Travel Time Grid ── */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="metric-block text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Car className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Distance</span>
          </div>
          <div className="text-[15px] font-extrabold text-gray-900 dark:text-white">
            {formatDistance(distanceKm)}
          </div>
        </div>

        <div className="metric-block text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Timer className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Travel</span>
          </div>
          <div className="text-[15px] font-extrabold text-gray-900 dark:text-white">
            {travelTimeMinutes !== null ? `~${travelTimeMinutes} min` : '—'}
          </div>
        </div>

        <div className="metric-block text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Activity className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Traffic</span>
          </div>
          <div className={`text-[12px] font-bold leading-tight mt-0.5 ${trafficColor(trafficLevel)}`}>
            {trafficLevel
              ? trafficLevel.replace(' traffic', '')
              : <span className="text-gray-400 dark:text-gray-500 text-[11px] font-normal">No data</span>}
          </div>
        </div>
      </div>

      {/* ── Contact / Hours Row ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-zinc-800 pt-3 mb-4">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span>
            {openStatus === null
              ? `${store.openingTime || '10:00 AM'} – ${store.closingTime || '09:30 PM'}`
              : openStatus
              ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{store.openingTime} – {store.closingTime}</span>
              : <span className="text-red-500 dark:text-red-400 font-medium">{store.openingTime} – {store.closingTime}</span>}
          </span>
        </div>
        {store.workingDays && (
          <span className="text-gray-400 dark:text-gray-500">· {store.workingDays}</span>
        )}
        {store.phone && (
          <a
            href={`tel:${store.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <span className="font-medium text-gray-700 dark:text-gray-300">{store.phone}</span>
          </a>
        )}
      </div>

      {/* ── How to Reach ── */}
      {howToReach && (
        <div className="text-[12px] text-gray-600 dark:text-gray-300 bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl mb-4 border border-blue-100/80 dark:border-blue-900/40 leading-relaxed">
          <span className="font-bold text-gray-800 dark:text-gray-200">How to Reach: </span>
          {howToReach}
        </div>
      )}

      {/* ── Action Buttons ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Get Directions */}
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="btn-directions flex-1 min-w-[120px] justify-center text-center no-underline"
          style={{ textDecoration: 'none' }}
        >
          <Navigation className="w-4 h-4" />
          <span>Get Directions</span>
        </a>

        {/* WhatsApp */}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn-wa text-[13px] no-underline"
            title="Chat on WhatsApp"
            style={{ textDecoration: 'none' }}
          >
            {/* WhatsApp icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        )}

        {/* Google Maps */}
        {mapsOpenUrl && (
          <a
            href={mapsOpenUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn-maps no-underline"
            title="Open in Google Maps"
            style={{ textDecoration: 'none' }}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline text-[13px]">Maps</span>
          </a>
        )}
      </div>
    </article>
  );
};
