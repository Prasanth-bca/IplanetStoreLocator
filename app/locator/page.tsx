'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { SearchHero } from '@/components/SearchHero';
import { StoreCard } from '@/components/StoreCard';
import { InteractiveMap } from '@/components/InteractiveMap';
import { OffersProvider } from '@/components/offers/OffersContext';
import { StoreOffersPanel } from '@/components/offers/StoreOffersPanel';
import { BankOffersPanel } from '@/components/offers/BankOffersPanel';
import { SearchResponse } from '@/types/store';
import { AlertCircle, Store as StoreIcon, ShieldAlert, Sparkles, Loader2, Navigation2 } from 'lucide-react';

export default function LocatorPage() {
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCount, setActiveCount] = useState(3);
  const [activeCategory, setActiveCategory] = useState<'Retail' | 'Care'>('Retail');
  const [currentQuery, setCurrentQuery] = useState('600017');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Perform initial search on mount to show default verified stores
  useEffect(() => {
    handleSearch('600017', 3, 'Retail');
  }, []);

  const handleSearch = async (
    query: string,
    count: number = activeCount,
    category: 'Retail' | 'Care' = activeCategory,
    lat?: number,
    lng?: number
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    setCurrentQuery(query);

    try {
      const params = new URLSearchParams();
      if (query) params.set('query', query);
      if (count) params.set('limit', count.toString());
      if (category) params.set('category', category);
      if (lat !== undefined && lng !== undefined) {
        params.set('lat', lat.toString());
        params.set('lng', lng.toString());
      }

      const res = await fetch(`/api/stores/search?${params.toString()}`);
      if (!res.ok) throw new Error('Search failed');
      const data: SearchResponse = await res.json();
      setSearchResponse(data);

      if (data.results.length > 0) {
        setSelectedStoreId(data.results[0].store.id);
      } else {
        setSelectedStoreId(undefined);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("We couldn't identify the exact location. Please try another nearby area, city or PIN code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      alert('Browser geolocation is not supported in this browser.');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handleSearch('Current Location', activeCount, activeCategory, latitude, longitude);
      },
      (err) => {
        setIsLoading(false);
        setErrorMessage('Location access was not enabled. You can search manually using your PIN code, area or landmark.');
      },
      { timeout: 10000 }
    );
  };

  const handleCountChange = (count: number) => {
    setActiveCount(count);
    handleSearch(currentQuery, count, activeCategory);
  };

  const handleCategoryChange = (category: 'Retail' | 'Care') => {
    setActiveCategory(category);
    handleSearch(currentQuery, activeCount, category);
  };

  return (
    <OffersProvider>
    <div className="min-h-screen flex flex-col bg-[#fbfbfd] dark:bg-[#0a0a0c] text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors duration-200">
      <Navbar />

      {/* Main Content Area: offers on the left; finder, results and map on the right */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 2xl:px-12 py-6">
       <div className="locator-grid">
        <div className="area-search">
          <SearchHero
            embedded
            onSearch={(q) => handleSearch(q, activeCount, activeCategory)}
            onUseLocation={handleUseLocation}
            isLoading={isLoading}
            activeCount={activeCount}
            onCountChange={handleCountChange}
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
        </div>

        <aside className="area-offers space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1" aria-label="Offers">
          <StoreOffersPanel />
          <BankOffersPanel />
        </aside>

        <div className="area-results">
        {/* Error notification */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Notice</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Informational banner when PIN covers multiple areas or fallback notice */}
        {searchResponse?.notice && (
          <div className="mb-6 p-4 glass-panel rounded-2xl border border-blue-200/80 dark:border-blue-800/60 text-blue-900 dark:text-blue-200 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
            <Sparkles className="w-4 h-4 text-[#0066cc] dark:text-[#2997ff] shrink-0 mt-0.5" />
            <p className="font-medium text-blue-950 dark:text-blue-100">{searchResponse.notice}</p>
          </div>
        )}

        {/* Results layout */}
        {searchResponse && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            {/* Left Column: Store Cards List */}
            <div className="xl:col-span-7 flex flex-col gap-5">
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-black/[0.08] dark:border-white/[0.1]">
                <div className="flex items-center gap-2 shrink-0">
                  <StoreIcon className="w-4 h-4 text-[#0066cc] dark:text-[#2997ff]" />
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                    {searchResponse.totalFound} {activeCategory === 'Care' ? 'Care & Service Centre' : 'Retail Store'}{searchResponse.totalFound === 1 ? '' : 's'} Found
                  </h2>
                </div>
                {searchResponse.detectedLocation?.name && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 min-w-0 flex items-center gap-1">
                    <Navigation2 className="w-3 h-3 shrink-0 text-[#0066cc] dark:text-[#2997ff]" />
                    <span className="truncate">Near: <strong className="text-gray-800 dark:text-gray-200">{searchResponse.detectedLocation.name}</strong></span>
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="bg-white dark:bg-[#16161a] rounded-3xl p-12 text-center border border-black/8 dark:border-white/10 shadow-sm flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-[#0066cc] dark:text-[#2997ff] animate-spin" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Calculating nearest stores & routes...</p>
                </div>
              ) : searchResponse.results.length === 0 ? (
                <div className="bg-white dark:bg-[#16161a] rounded-3xl p-12 text-center border border-black/8 dark:border-white/10 shadow-sm">
                  <ShieldAlert className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    No iPlanet {activeCategory === 'Care' ? 'Care & Service Centre' : 'Retail Store'}s found
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                    Sorry, we couldn&apos;t find an official iPlanet {activeCategory === 'Care' ? 'Care & Service Centre' : 'Retail Store'} matching this query. Please try searching another nearby area, city (e.g. Chennai, Coimbatore, Bengaluru) or PIN code.
                  </p>
                </div>
              ) : (
                searchResponse.results.map((result, idx) => (
                  <StoreCard
                    key={result.store.id}
                    result={result}
                    isSelected={result.store.id === selectedStoreId}
                    onSelect={() => setSelectedStoreId(result.store.id)}
                    index={idx}
                  />
                ))
              )}
            </div>

            {/* Right Column: Google Interactive Map */}
            <div className="xl:col-span-5 xl:sticky xl:top-24">
              <InteractiveMap
                results={searchResponse.results}
                selectedStoreId={selectedStoreId}
                onSelectStore={(id) => setSelectedStoreId(id)}
                userLocation={searchResponse.detectedLocation}
              />
            </div>
          </div>
        )}
        </div>
       </div>
      </main>

    </div>
    </OffersProvider>
  );
}
