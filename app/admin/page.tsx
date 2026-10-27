'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, StoreStatus } from '@/types/store';
import {
  ArrowLeft,
  Upload,
  Plus,
  Search,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Download,
  Store as StoreIcon,
  Wrench,
  Layers,
  MapPin,
  LogOut,
  Package
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ViewToggle, useViewMode } from '@/components/ViewToggle';

export default function AdminPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const [view, setView] = useViewMode('admin-stores-view');
  const [activeCategory, setActiveCategory] = useState<'Retail' | 'Care'>('Retail');
  const [stores, setStores] = useState<Store[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Counts for tabs
  const [retailCount, setRetailCount] = useState<number | null>(null);
  const [careCount, setCareCount] = useState<number | null>(null);

  // Modal for new store
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStore, setNewStore] = useState({
    posCode: '',
    storeName: '',
    storeType: 'Retail',
    address: '',
    area: '',
    city: '',
    state: 'Tamil Nadu',
    pincode: '',
    landmark: '',
    latitude: '',
    longitude: '',
    phone: '080-4699-9888'
  });

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchStores = useCallback(async (cat: 'Retail' | 'Care') => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/stores?category=${cat}`);
      const data = await res.json();
      setStores(data.stores || []);
      if (cat === 'Retail') {
        setRetailCount(data.total || (data.stores ? data.stores.length : 0));
      } else {
        setCareCount(data.total || (data.stores ? data.stores.length : 0));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch counts on mount
  useEffect(() => {
    fetchStores(activeCategory);
    // Also fetch the other category count in background
    const otherCat = activeCategory === 'Retail' ? 'Care' : 'Retail';
    fetch(`/api/admin/stores?category=${otherCat}`)
      .then(res => res.json())
      .then(data => {
        if (otherCat === 'Retail') setRetailCount(data.total || 0);
        else setCareCount(data.total || 0);
      })
      .catch(() => {});
  }, [activeCategory, fetchStores]);

  const handleCategorySwitch = (cat: 'Retail' | 'Care') => {
    if (cat === activeCategory) return;
    setActiveCategory(cat);
    setSearchFilter('');
    setStatusFilter('ALL');
    setStateFilter('ALL');
    setCityFilter('ALL');
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStore)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to add store');
        return;
      }
      setIsAddModalOpen(false);
      setNewStore({
        posCode: '',
        storeName: '',
        storeType: 'Retail',
        address: '',
        area: '',
        city: '',
        state: 'Tamil Nadu',
        pincode: '',
        landmark: '',
        latitude: '',
        longitude: '',
        phone: '080-4699-9888'
      });
      fetchStores(activeCategory);
    } catch (err) {
      alert('Error creating store');
    }
  };

  const handleDeleteStore = async (id: string, posCode: string) => {
    if (!confirm(`Are you sure you want to deactivate/delete location ${posCode}?`)) return;
    try {
      const res = await fetch(`/api/admin/stores/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchStores(activeCategory);
      }
    } catch (err) {
      alert('Failed to delete location');
    }
  };

  const handleStatusChange = async (id: string, newStatus: StoreStatus) => {
    try {
      await fetch(`/api/admin/stores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchStores(activeCategory);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setIsImporting(true);
    setImportStatus(null);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setImportStatus(data);
      if (res.ok) {
        fetchStores(activeCategory);
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Unique States and Cities for dynamic filter dropdowns
  const availableStates = Array.from(new Set(stores.map(s => s.state).filter(Boolean))).sort();
  const availableCities = Array.from(
    new Set(
      stores
        .filter(s => stateFilter === 'ALL' || s.state === stateFilter)
        .map(s => s.city)
        .filter(Boolean)
    )
  ).sort();

  const filteredStores = stores.filter(s => {
    const q = searchFilter.toLowerCase();
    const matchesSearch =
      s.posCode.toLowerCase().includes(q) ||
      s.storeName.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.state.toLowerCase().includes(q) ||
      s.pincode.includes(q) ||
      (s.locationType && s.locationType.toLowerCase().includes(q)) ||
      (s.area && s.area.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesState = stateFilter === 'ALL' || s.state === stateFilter;
    const matchesCity = cityFilter === 'ALL' || s.city === cityFilter;

    return matchesSearch && matchesStatus && matchesState && matchesCity;
  });

  const statusSelect = (store: Store) => (
    <select
      value={store.status}
      onChange={(e) => handleStatusChange(store.id, e.target.value as StoreStatus)}
      aria-label={`Status for ${store.posCode}`}
      className={`text-xs font-bold py-1.5 px-2 rounded-lg border outline-none ${
        store.status === 'Active'
          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          : store.status === 'TemporarilyClosed'
          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
          : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-zinc-700'
      }`}
    >
      <option value="Active">Active</option>
      <option value="TemporarilyClosed">Temporarily Closed</option>
      <option value="ComingSoon">Coming Soon</option>
      <option value="Inactive">Inactive</option>
    </select>
  );

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0a0a0c] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Admin Navbar */}
      <header className="bg-white dark:bg-[#0e0e11] border-b border-gray-200 dark:border-white/10 px-6 py-4 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Customer Locator</span>
            </Link>
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              iPlanet Master Admin Portal
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Store</span>
            </button>

            <Link
              href="/admin/stock"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl text-xs font-semibold transition"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Stock</span>
            </Link>
            <Link
              href="/admin/products"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl text-xs font-semibold transition"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Products</span>
            </Link>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 bg-gray-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Bulk Import Card */}
        <section className="bg-white dark:bg-[#16161a] rounded-3xl p-6 border border-gray-200/80 dark:border-white/10 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Bulk Import Store Master (XLSX / CSV)</span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Upload Master Sheet.xlsx or Planet Care CSV to update store registry. Validates POS uniqueness, PIN formats, and reports duplicates.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/iPlanet_Store_Import_Template.xlsx"
                download="iPlanet_Store_Import_Template.xlsx"
                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-semibold rounded-xl border border-blue-200/80 dark:border-blue-800/60 transition flex items-center gap-1.5"
                title="Download Excel Template"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download XLSX Template</span>
              </a>
              <a
                href="/iPlanet_Store_Import_Template.csv"
                download="iPlanet_Store_Import_Template.csv"
                className="px-3 py-1.5 bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 text-xs font-semibold rounded-xl border border-gray-200 dark:border-zinc-700 transition flex items-center gap-1.5"
                title="Download CSV Template"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </a>
            </div>
          </div>

          <form onSubmit={handleFileUpload} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
              className="text-xs text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-blue-950/80 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer"
            />
            <button
              type="submit"
              disabled={!importFile || isImporting}
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition flex items-center gap-2"
            >
              {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Process Import</span>
            </button>
          </form>

          {/* Import summary alert */}
          {importStatus && (
            <div className={`mt-4 p-4 rounded-2xl border text-xs ${
              importStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="font-bold mb-1 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Import Summary: {importStatus.validImported} imported, {importStatus.duplicatesCount} duplicates, {importStatus.errorsCount} errors</span>
              </div>
              {importStatus.errors && importStatus.errors.length > 0 && (
                <ul className="list-disc pl-5 mt-2 space-y-1 text-rose-700">
                  {importStatus.errors.slice(0, 5).map((e: any, i: number) => (
                    <li key={i}>Row {e.row}: {e.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Master Registry Table Card */}
        <section className="bg-white dark:bg-[#16161a] rounded-3xl border border-gray-200/80 dark:border-white/10 shadow-sm overflow-hidden">
          {/* CATEGORY TOGGLE BAR ABOVE TABLE */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-200/80 dark:border-white/10 bg-gradient-to-r from-gray-50/50 to-white dark:from-[#131317] dark:to-[#16161a] flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Store Master Registry</span>
              </div>
              <h2 className="text-base font-extrabold text-gray-900 dark:text-white">
                {activeCategory === 'Retail' ? 'iPlanet Retail Stores' : 'iPlanet Care & Service Centres'}
              </h2>
            </div>

            {/* TOGGLE PILLS: Retail Stores / Care & Service */}
            <div className="inline-flex items-center p-1 bg-gray-100 dark:bg-zinc-800 rounded-2xl border border-gray-200/70 dark:border-zinc-700 shadow-inner">
              <button
                type="button"
                onClick={() => handleCategorySwitch('Retail')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeCategory === 'Retail'
                    ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-400 shadow-sm border border-gray-200/80 dark:border-zinc-700'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <StoreIcon className={`w-3.5 h-3.5 ${activeCategory === 'Retail' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                <span>Retail Stores</span>
                {retailCount !== null && (
                  <span className={`ml-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    activeCategory === 'Retail' ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300' : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {retailCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleCategorySwitch('Care')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeCategory === 'Care'
                    ? 'bg-white dark:bg-zinc-900 text-purple-700 dark:text-purple-400 shadow-sm border border-gray-200/80 dark:border-zinc-700'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Wrench className={`w-3.5 h-3.5 ${activeCategory === 'Care' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} />
                <span>Care & Service</span>
                {careCount !== null && (
                  <span className={`ml-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    activeCategory === 'Care' ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300' : 'bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-gray-300'
                  }`}>
                    {careCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-6 border-b border-gray-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter by POS code, city, PIN, or name..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 py-2 px-3 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 outline-none hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="TemporarilyClosed">Temporarily Closed</option>
                <option value="ComingSoon">Coming Soon</option>
                <option value="Inactive">Inactive</option>
              </select>

              {/* State Filter */}
              <select
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setCityFilter('ALL');
                }}
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 py-2 px-3 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 outline-none hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
              >
                <option value="ALL">All States ({availableStates.length})</option>
                {availableStates.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>

              {/* City Filter */}
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 py-2 px-3 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 outline-none hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
              >
                <option value="ALL">All Cities ({availableCities.length})</option>
                {availableCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>

              {(statusFilter !== 'ALL' || stateFilter !== 'ALL' || cityFilter !== 'ALL' || searchFilter) && (
                <button
                  onClick={() => {
                    setStatusFilter('ALL');
                    setStateFilter('ALL');
                    setCityFilter('ALL');
                    setSearchFilter('');
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold px-2 py-1 transition"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                Showing {filteredStores.length} of {stores.length} {activeCategory === 'Retail' ? 'stores' : 'centres'}
              </div>
              <ViewToggle value={view} onChange={setView} />
            </div>
          </div>

          {/* Stores: list (default) or cards */}
          {isLoading ? (
            <div className="py-14 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-400 dark:text-gray-500">
              No locations found matching your filter criteria.
            </div>
          ) : view === 'list' ? (
            <div>
              <div className="hidden md:grid grid-cols-[88px_minmax(0,2.2fr)_minmax(0,1.5fr)_84px_150px_48px] gap-4 px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 bg-gray-50/80 dark:bg-zinc-800/60 border-b border-gray-100 dark:border-white/10">
                <span>POS code</span>
                <span>Store</span>
                <span>Location</span>
                <span>PIN</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredStores.map(store => {
                  const isCare = store.locationType === 'iPlanet Care / Service Centre' || store.category === 'Care';
                  const hasCoords = !!(store.latitude && store.longitude);
                  return (
                    <li
                      key={store.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[88px_minmax(0,2.2fr)_minmax(0,1.5fr)_84px_150px_48px] items-center gap-x-4 gap-y-2 px-6 py-3 hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition"
                    >
                      <span className="hidden md:inline-block font-mono text-xs font-extrabold text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-lg w-fit">
                        {store.posCode}
                      </span>

                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center ${
                            isCare
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                          }`}
                          title={isCare ? 'iPlanet Care / Service Centre' : 'iPlanet Retail Store'}
                        >
                          {isCare ? <Wrench className="w-5 h-5" /> : <StoreIcon className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-950 dark:text-white truncate" title={store.storeName}>
                            {store.storeName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            <span className="md:hidden font-mono font-semibold text-gray-700 dark:text-gray-300">{store.posCode} · </span>
                            {isCare ? 'Care / Service' : 'Retail'}
                            {!hasCoords && <span className="ml-2 font-semibold text-amber-600 dark:text-amber-400">No coordinates</span>}
                          </div>
                        </div>
                      </div>

                      <div className="hidden md:block min-w-0">
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{store.city}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {[store.area || store.locality, store.state].filter(Boolean).join(' · ')}
                        </div>
                      </div>

                      <span className="hidden md:block font-mono text-xs text-gray-600 dark:text-gray-300">{store.pincode}</span>

                      <div className="hidden md:block">{statusSelect(store)}</div>

                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleDeleteStore(store.id, store.posCode)}
                          aria-label={`Delete ${store.posCode}`}
                          className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition"
                          title="Delete Location"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="md:hidden col-span-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="truncate">
                          {store.city}, {store.state} · <span className="font-mono">{store.pincode}</span>
                        </span>
                        {statusSelect(store)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="p-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredStores.map(store => {
                const isCare = store.locationType === 'iPlanet Care / Service Centre' || store.category === 'Care';
                const hasCoords = !!(store.latitude && store.longitude);
                return (
                  <article
                    key={store.id}
                    className="rounded-3xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#16161a] overflow-hidden flex flex-col transition hover:shadow-lg"
                  >
                    <div className="p-5 flex items-start gap-4">
                      <div
                        className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center ${
                          isCare
                            ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400'
                            : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {isCare ? <Wrench className="w-7 h-7" /> : <StoreIcon className="w-7 h-7" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">{isCare ? 'Care / Service' : 'Retail'}</div>
                          <span className="font-mono text-xs font-extrabold text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg shrink-0">
                            {store.posCode}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-gray-950 dark:text-white leading-snug">{store.storeName}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-1.5 mt-1">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            {[store.area || store.locality, store.city].filter(Boolean).join(', ')}, {store.state}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-px bg-gray-100 dark:bg-white/5 border-y border-gray-100 dark:border-white/5">
                      <div className="bg-white dark:bg-[#16161a] px-5 py-3">
                        <div className="text-sm font-extrabold font-mono text-gray-900 dark:text-white leading-none">{store.pincode}</div>
                        <div className="text-[11px] font-semibold text-gray-500 mt-1">PIN code</div>
                      </div>
                      <div className="bg-white dark:bg-[#16161a] px-5 py-3">
                        <div className={`text-sm font-extrabold leading-none ${hasCoords ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {hasCoords ? 'Mapped' : 'Pending'}
                        </div>
                        <div className="text-[11px] font-semibold text-gray-500 mt-1">Coordinates</div>
                      </div>
                    </div>

                    <div className="mt-auto px-5 py-3 flex items-center justify-between gap-3">
                      {statusSelect(store)}
                      <button
                        onClick={() => handleDeleteStore(store.id, store.posCode)}
                        aria-label={`Delete ${store.posCode}`}
                        className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition"
                        title="Delete Location"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Add Store Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16161a] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add New iPlanet Store</h3>
            <form onSubmit={handleCreateStore} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">POS Code *</label>
                  <input
                    type="text"
                    required
                    value={newStore.posCode}
                    onChange={(e) => setNewStore({ ...newStore, posCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. RMM"
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Store Name *</label>
                  <input
                    type="text"
                    required
                    value={newStore.storeName}
                    onChange={(e) => setNewStore({ ...newStore, storeName: e.target.value })}
                    placeholder="iPlanet Royal Meenakshi Mall"
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Full Address *</label>
                <textarea
                  required
                  rows={2}
                  value={newStore.address}
                  onChange={(e) => setNewStore({ ...newStore, address: e.target.value })}
                  placeholder="Full street address..."
                  className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={newStore.city}
                    onChange={(e) => setNewStore({ ...newStore, city: e.target.value })}
                    placeholder="Bengaluru"
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Area / Locality</label>
                  <input
                    type="text"
                    value={newStore.area}
                    onChange={(e) => setNewStore({ ...newStore, area: e.target.value })}
                    placeholder="Bannerghatta Rd"
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">PIN Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newStore.pincode}
                    onChange={(e) => setNewStore({ ...newStore, pincode: e.target.value })}
                    placeholder="560076"
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl font-mono text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newStore.latitude}
                    onChange={(e) => setNewStore({ ...newStore, latitude: e.target.value })}
                    placeholder="12.8752"
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl font-mono text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newStore.longitude}
                    onChange={(e) => setNewStore({ ...newStore, longitude: e.target.value })}
                    placeholder="77.5959"
                    className="w-full p-2.5 bg-gray-50 dark:bg-zinc-800 border dark:border-zinc-700 rounded-xl font-mono text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border dark:border-zinc-700 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
                >
                  Save Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
