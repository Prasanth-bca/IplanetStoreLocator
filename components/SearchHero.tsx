'use client';

import React, { useState, useRef } from 'react';
import { Search, MapPin, Loader2, Sparkles, Store, Wrench, ChevronRight } from 'lucide-react';

interface SearchHeroProps {
  onSearch: (query: string, count?: number) => void;
  onUseLocation: () => void;
  isLoading: boolean;
  activeCount: number;
  onCountChange: (count: number) => void;
  activeCategory: 'Retail' | 'Care';
  onCategoryChange: (cat: 'Retail' | 'Care') => void;
}

export const SearchHero: React.FC<SearchHeroProps> = ({
  onSearch,
  onUseLocation,
  isLoading,
  activeCount,
  onCountChange,
  activeCategory,
  onCategoryChange,
}) => {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSearch(inputVal.trim());
    }
  };

  const handleSuggestion = (query: string) => {
    setInputVal(query);
    onSearch(query);
    inputRef.current?.focus();
  };

  const sampleQueries = [
    { label: '📍 600016', query: '600016' },
    { label: '🏙️ Whitefield', query: 'Whitefield' },
    { label: '🏛️ Ashoka Pillar', query: 'Ashoka Pillar' },
    { label: '🏷️ RMM', query: 'RMM' },
    { label: '🏙️ Coimbatore', query: 'Coimbatore' },
    { label: '🛍️ Phoenix Mall', query: 'iPlanet near Phoenix Mall' },
    { label: '📌 Mogappair', query: 'Mogappair' },
    { label: '🔢 3 near HSR', query: '3 iPlanet stores near HSR' },
  ];

  return (
    <section className="hero-gradient w-full border-b border-black/[0.06] pt-12 pb-14 px-4 sm:px-6 overflow-hidden relative">
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(0,102,204,0.15) 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -left-16 w-72 h-72 rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(90,200,250,0.2) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-3xl mx-auto text-center relative z-10">
        {/* Category Toggle */}
        <div className="flex justify-center mb-7">
          <div className="category-toggle">
            <button
              onClick={() => onCategoryChange('Retail')}
              className={`category-btn flex items-center gap-1.5 ${activeCategory === 'Retail' ? 'active' : ''}`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Retail Stores</span>
            </button>
            <button
              onClick={() => onCategoryChange('Care')}
              className={`category-btn flex items-center gap-1.5 ${activeCategory === 'Care' ? 'active' : ''}`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Care / Service</span>
            </button>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-2">
          <h1 className="text-[32px] sm:text-[42px] md:text-[52px] font-black tracking-tight text-gray-950 dark:text-white leading-[1.08]">
            Find Your Nearest{' '}
            <span
              className="inline-block"
              style={{
                background: 'linear-gradient(135deg, #0066cc 0%, #007aff 50%, #5ac8fa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              iPlanet
            </span>{' '}
            {activeCategory === 'Care' ? 'Service Centre' : 'Store'}
          </h1>
        </div>

        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-8 leading-relaxed font-medium">
          Official Apple Authorised Reseller · Search by PIN code, area, landmark, city, or POS code
        </p>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto mb-4">
          <div className="search-box flex items-center p-1.5 gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 shrink-0">
              {isLoading ? (
                <Loader2 className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400 animate-spin" style={{ width: 18, height: 18 }} />
              ) : (
                <Search className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" style={{ width: 18, height: 18 }} />
              )}
            </div>

            <input
              ref={inputRef}
              type="search"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Search by PIN code, area, landmark, city or store code..."
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-[15px] font-normal outline-none py-2 pr-1 min-w-0"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />

            <button
              type="submit"
              disabled={isLoading || !inputVal.trim()}
              className="btn-primary shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Searching…</span>
                </>
              ) : (
                <>
                  <span>Search</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6 text-sm">
          {/* GPS Button */}
          <button
            onClick={onUseLocation}
            type="button"
            disabled={isLoading}
            className="btn-secondary text-xs"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Use My Location</span>
          </button>

          {/* Result Count */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#16161b] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Show:</span>
            <div className="flex items-center gap-0.5">
              {[1, 3, 5, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onCountChange(num)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    activeCount === num
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400 font-medium">stores</span>
          </div>
        </div>

        {/* Quick Search Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="flex items-center gap-1 text-xs text-gray-400 font-semibold">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Try:
          </span>
          {sampleQueries.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSuggestion(item.query)}
              className="suggestion-pill"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
