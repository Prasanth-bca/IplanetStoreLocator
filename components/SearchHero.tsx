'use client';

import React, { useState } from 'react';
import { Search, MapPin, Loader2, Store, Wrench } from 'lucide-react';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSearch(inputVal.trim());
    }
  };

  return (
    <section className="w-full border-b border-black/[0.06] dark:border-white/10 bg-white/60 dark:bg-[#0e0e11]/60">
      {/* Same container as the navbar and results, so everything shares one left edge */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-3">
        <h1 className="sr-only">Find your nearest iPlanet {activeCategory === 'Care' ? 'service centre' : 'store'}</h1>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="category-toggle">
            <button
              type="button"
              onClick={() => onCategoryChange('Retail')}
              className={`category-btn flex items-center gap-1.5 ${activeCategory === 'Retail' ? 'active' : ''}`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Retail Stores</span>
            </button>
            <button
              type="button"
              onClick={() => onCategoryChange('Care')}
              className={`category-btn flex items-center gap-1.5 ${activeCategory === 'Care' ? 'active' : ''}`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Care / Service</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>Show</span>
            <div className="flex items-center gap-0.5 bg-white dark:bg-[#16161b] border border-gray-200 dark:border-white/10 rounded-xl p-0.5">
              {[1, 3, 5, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onCountChange(num)}
                  aria-pressed={activeCount === num}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    activeCount === num
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-stretch gap-2">
          <div className="search-box flex items-center p-1.5 gap-2 flex-1 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 shrink-0">
              {isLoading ? (
                <Loader2 className="text-blue-600 dark:text-blue-400 animate-spin" style={{ width: 18, height: 18 }} />
              ) : (
                <Search className="text-blue-600 dark:text-blue-400" style={{ width: 18, height: 18 }} />
              )}
            </div>

            <input
              type="search"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="PIN code, area, landmark, city or store code"
              aria-label="Search stores"
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-[15px] outline-none py-2 pr-1 min-w-0"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />

            <button
              type="submit"
              disabled={isLoading || !inputVal.trim()}
              className="btn-primary shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isLoading ? 'Searching…' : 'Search'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onUseLocation}
            disabled={isLoading}
            className="btn-secondary justify-center text-xs sm:px-5"
          >
            <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Use my location</span>
          </button>
        </form>
      </div>
    </section>
  );
};
