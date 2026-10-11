'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Building
} from 'lucide-react';

export default function AdminPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/stores');
      const data = await res.json();
      setStores(data.stores || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
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
      fetchStores();
    } catch (err) {
      alert('Error creating store');
    }
  };

  const handleDeleteStore = async (id: string, posCode: string) => {
    if (!confirm(`Are you sure you want to deactivate/delete store ${posCode}?`)) return;
    try {
      const res = await fetch(`/api/admin/stores/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchStores();
      }
    } catch (err) {
      alert('Failed to delete store');
    }
  };

  const handleStatusChange = async (id: string, newStatus: StoreStatus) => {
    try {
      await fetch(`/api/admin/stores/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchStores();
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
        fetchStores();
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredStores = stores.filter(s => {
    const q = searchFilter.toLowerCase();
    const matchesSearch =
      s.posCode.toLowerCase().includes(q) ||
      s.storeName.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.pincode.includes(q) ||
      (s.area && s.area.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Admin Navbar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-gray-100 px-3 py-1.5 rounded-lg transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Customer Locator</span>
            </Link>
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
              iPlanet Master Admin Portal
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Store</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Bulk Import Card */}
        <section className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Bulk Import Store Master (XLSX / CSV)</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Upload Master Sheet.xlsx to update store registry. Validates POS uniqueness, PIN formats, and report duplicates.
              </p>
            </div>
          </div>

          <form onSubmit={handleFileUpload} className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setImportFile(e.target.files ? e.target.files[0] : null)}
              className="text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            <button
              type="submit"
              disabled={!importFile || isImporting}
              className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition flex items-center gap-2"
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

        {/* Store Master Table */}
        <section className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden">
          {/* Filters Bar */}
          <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative w-full max-w-sm">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter by POS code, city, PIN, or name..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 py-2 px-3 rounded-xl text-xs font-semibold text-gray-700 outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Active">Active</option>
                <option value="TemporarilyClosed">Temporarily Closed</option>
                <option value="ComingSoon">Coming Soon</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="text-xs font-bold text-gray-500">
              Showing {filteredStores.length} of {stores.length} stores
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">POS Code</th>
                  <th className="py-3 px-4">Store Name</th>
                  <th className="py-3 px-4">City / Area</th>
                  <th className="py-3 px-4">PIN Code</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Coordinates</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                    </td>
                  </tr>
                ) : filteredStores.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      No stores found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredStores.map((store) => (
                    <tr key={store.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        {store.posCode}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-900 max-w-[200px] truncate">
                        {store.storeName}
                      </td>
                      <td className="py-3.5 px-4">
                        {store.city} {store.area ? `(${store.area})` : ''}
                      </td>
                      <td className="py-3.5 px-4 font-mono">{store.pincode}</td>
                      <td className="py-3.5 px-4">
                        <select
                          value={store.status}
                          onChange={(e) => handleStatusChange(store.id, e.target.value as StoreStatus)}
                          className={`text-xs font-bold py-1 px-2 rounded-lg border outline-none ${
                            store.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : store.status === 'TemporarilyClosed'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-gray-100 text-gray-700 border-gray-300'
                          }`}
                        >
                          <option value="Active">Active</option>
                          <option value="TemporarilyClosed">Temporarily Closed</option>
                          <option value="ComingSoon">Coming Soon</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-gray-400">
                        {store.latitude && store.longitude ? `${store.latitude}, ${store.longitude}` : 'Pending'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteStore(store.id, store.posCode)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Store"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Add Store Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add New iPlanet Store</h3>
            <form onSubmit={handleCreateStore} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">POS Code *</label>
                  <input
                    type="text"
                    required
                    value={newStore.posCode}
                    onChange={(e) => setNewStore({ ...newStore, posCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. RMM"
                    className="w-full p-2.5 bg-gray-50 border rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Store Name *</label>
                  <input
                    type="text"
                    required
                    value={newStore.storeName}
                    onChange={(e) => setNewStore({ ...newStore, storeName: e.target.value })}
                    placeholder="iPlanet Royal Meenakshi Mall"
                    className="w-full p-2.5 bg-gray-50 border rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Full Address *</label>
                <textarea
                  required
                  rows={2}
                  value={newStore.address}
                  onChange={(e) => setNewStore({ ...newStore, address: e.target.value })}
                  placeholder="Full street address..."
                  className="w-full p-2.5 bg-gray-50 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={newStore.city}
                    onChange={(e) => setNewStore({ ...newStore, city: e.target.value })}
                    placeholder="Bengaluru"
                    className="w-full p-2.5 bg-gray-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Area / Locality</label>
                  <input
                    type="text"
                    value={newStore.area}
                    onChange={(e) => setNewStore({ ...newStore, area: e.target.value })}
                    placeholder="Bannerghatta Rd"
                    className="w-full p-2.5 bg-gray-50 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">PIN Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newStore.pincode}
                    onChange={(e) => setNewStore({ ...newStore, pincode: e.target.value })}
                    placeholder="560076"
                    className="w-full p-2.5 bg-gray-50 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newStore.latitude}
                    onChange={(e) => setNewStore({ ...newStore, latitude: e.target.value })}
                    placeholder="12.8752"
                    className="w-full p-2.5 bg-gray-50 border rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newStore.longitude}
                    onChange={(e) => setNewStore({ ...newStore, longitude: e.target.value })}
                    placeholder="77.5959"
                    className="w-full p-2.5 bg-gray-50 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border rounded-xl text-gray-700 font-semibold"
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
