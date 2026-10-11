'use client';

import React from 'react';
import { StoreSearchResult } from '@/types/store';
import { MapPin, Navigation, ExternalLink, Layers } from 'lucide-react';

interface InteractiveMapProps {
  results: StoreSearchResult[];
  selectedStoreId?: string;
  onSelectStore: (id: string) => void;
  userLocation?: { latitude?: number; longitude?: number; name?: string } | null;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  results,
  selectedStoreId,
  onSelectStore,
  userLocation,
}) => {
  const validStores = results.filter((r) => r.store.latitude && r.store.longitude);
  const selectedResult =
    results.find((r) => r.store.id === selectedStoreId) || results[0] || null;

  // Compute map center: selected store or first result or user location or default Chennai
  const centerLat = selectedResult?.store.latitude || userLocation?.latitude || 13.0406;
  const centerLng = selectedResult?.store.longitude || userLocation?.longitude || 80.2346;

  // Google Maps Embed URL
  const mapEmbedUrl = `https://maps.google.com/maps?q=${centerLat},${centerLng}&z=14&output=embed`;

  // External full directions or search URL
  const externalMapUrl = selectedResult?.store.latitude && selectedResult?.store.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${selectedResult.store.latitude},${selectedResult.store.longitude}`
    : selectedResult?.store.googleMapsUrl || `https://maps.google.com/?q=${centerLat},${centerLng}`;

  return (
    <div className="relative w-full h-[540px] lg:h-[620px] rounded-3xl overflow-hidden border border-black/10 shadow-lg bg-gray-100 flex flex-col group">
      {/* ── Top Bar Overlay ── */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none gap-2">
        {/* Count Pill */}
        <div className="glass-panel px-3.5 py-2 rounded-2xl shadow-md text-xs font-semibold text-gray-800 flex items-center gap-2 pointer-events-auto">
          <MapPin className="w-4 h-4 text-[#0066cc]" />
          <span>{validStores.length} Stores Mapped</span>
        </div>

        {/* Selected Store Pill */}
        {selectedResult && (
          <div className="glass-panel px-3 py-1.5 rounded-2xl shadow-md text-xs font-medium text-gray-800 pointer-events-auto flex items-center gap-2 max-w-[240px]">
            <span className="font-mono bg-blue-50 text-[#0066cc] font-bold px-1.5 py-0.5 rounded border border-blue-100">
              {selectedResult.store.posCode}
            </span>
            <span className="truncate text-gray-700 font-semibold">{selectedResult.store.storeName}</span>
          </div>
        )}
      </div>

      {/* ── External Maps Quick Button ── */}
      <a
        href={externalMapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-16 right-4 z-20 glass-panel hover:bg-white text-gray-700 hover:text-[#0066cc] p-2.5 rounded-2xl shadow-md transition-all flex items-center gap-1.5 text-xs font-semibold"
        title="Open in Google Maps fullscreen"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Open in Maps</span>
      </a>

      {/* ── Google Maps Iframe ── */}
      <iframe
        title="iPlanet Interactive Map"
        src={mapEmbedUrl}
        className="w-full h-full border-0 contrast-[1.02] filter"
        loading="lazy"
        allowFullScreen
      />

      {/* ── Bottom Store Selector Carousel ── */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex gap-2 overflow-x-auto pb-1 scrollbar-none pointer-events-auto">
        {results.map((r) => {
          const isSelected = r.store.id === selectedStoreId || (!selectedStoreId && r.rank === 1);
          return (
            <button
              key={r.store.id}
              onClick={() => onSelectStore(r.store.id)}
              className={`flex-shrink-0 text-left px-3.5 py-2.5 rounded-2xl text-xs transition-all shadow-md backdrop-blur-xl border ${
                isSelected
                  ? 'bg-[#0066cc] text-white border-[#0055bb] ring-2 ring-blue-400/40 shadow-blue-500/20'
                  : 'bg-white/90 text-gray-800 border-white/80 hover:bg-white hover:border-gray-300'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <span className="font-mono px-1 py-0.2 rounded bg-black/10">{r.store.posCode}</span>
                <span>• #{r.rank}</span>
                {r.isPreferred && <span className="text-[10px]">⭐</span>}
              </div>
              <div className="text-[11px] truncate max-w-[150px] opacity-90 mt-0.5">
                {r.store.city} {r.distanceKm !== null ? `(${r.distanceKm < 1 ? Math.round(r.distanceKm * 1000) + 'm' : r.distanceKm + 'km'})` : ''}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
