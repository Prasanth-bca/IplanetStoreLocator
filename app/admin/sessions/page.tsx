'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  Download,
  Globe,
  Home,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserX,
  Users,
  X,
  AlertTriangle,
  Clock,
  Activity,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCurrentUser } from '@/lib/useCurrentUser';

interface LiveSession {
  id: string;
  userId: string | null;
  username: string;
  name: string | null;
  role: string | null;
  ipAddress: string | null;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet' | null;
  browser: string | null;
  os: string | null;
  currentPath: string | null;
  status: string;
  loginAt: string;
  lastActiveAt: string;
  liveStatus: 'ONLINE' | 'IDLE';
}

interface HistorySession {
  id: string;
  userId: string | null;
  username: string;
  name: string | null;
  role: string | null;
  ipAddress: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  currentPath: string | null;
  status: string;
  loginAt: string;
  lastActiveAt: string;
  endedAt: string | null;
  failReason: string | null;
}

interface Stats {
  totalOnline: number;
  totalIdle: number;
  onlineAdmins: number;
  onlineSales: number;
  desktopCount: number;
  mobileCount: number;
}

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

function calcDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((e - s) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diff < 15) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function AdminSessionsPage() {
  const { user: me } = useCurrentUser();
  const [tab, setTab] = useState<'live' | 'history'>('live');
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalOnline: 0,
    totalIdle: 0,
    onlineAdmins: 0,
    onlineSales: 0,
    desktopCount: 0,
    mobileCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'SALES'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOGGED_OUT' | 'REVOKED' | 'FAILED'>('ALL');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/sessions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load session data');
      setLiveSessions(data.liveSessions || []);
      setHistory(data.recentHistory || []);
      if (data.stats) setStats(data.stats);
    } catch (e: any) {
      if (!isSilent) {
        setToast({ ok: false, text: e.message || 'Error updating sessions' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh interval (every 10s for live monitoring)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ok ? 3500 : 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleRevoke = async (sessionId: string, username: string) => {
    if (!confirm(`Are you sure you want to forcibly terminate the session for "${username}"? They will be signed out immediately.`)) {
      return;
    }
    setRevokingId(sessionId);
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not terminate session');
      setToast({ ok: true, text: `Session terminated for ${username}` });
      await loadData();
    } catch (e: any) {
      setToast({ ok: false, text: e.message || 'Failed to terminate session' });
    } finally {
      setRevokingId(null);
    }
  };

  // Filtered lists
  const filteredLive = liveSessions.filter(s => {
    if (roleFilter !== 'ALL' && s.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        s.username.toLowerCase().includes(q) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.ipAddress && s.ipAddress.includes(q)) ||
        (s.currentPath && s.currentPath.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const filteredHistory = history.filter(s => {
    if (roleFilter !== 'ALL' && s.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        s.username.toLowerCase().includes(q) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.ipAddress && s.ipAddress.includes(q));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0a0a0c] text-gray-900 dark:text-gray-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-[#111115]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition"
              title="Back to Admin Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                  User Monitoring & Login Sessions
                </h1>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Monitor
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                Real-time active user tracking, activity heartbeat, and historical session audit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                autoRefresh
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-300'
                  : 'bg-white border-gray-200 text-gray-600 dark:bg-zinc-900 dark:border-zinc-800 dark:text-gray-400'
              }`}
              title={autoRefresh ? 'Auto-refresh active (every 10s)' : 'Auto-refresh paused'}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{autoRefresh ? 'Live Updating' : 'Paused'}</span>
            </button>

            <button
              onClick={() => loadData(false)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300 transition disabled:opacity-50"
              title="Refresh Now"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            <a
              href="/api/admin/sessions/export"
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-bold transition shadow-sm"
              title="Export Full Audit Log to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Report</span>
            </a>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Dashboard Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Tile 1: Total Online */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#16161a] border border-gray-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Live Users</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {stats.totalOnline}
              </span>
              <span className="text-xs text-gray-500">
                {stats.totalIdle > 0 ? `+ ${stats.totalIdle} idle` : 'active now'}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 mt-1">Heartbeat within &lt; 2 mins</span>
          </div>

          {/* Tile 2: Online Admins */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#16161a] border border-gray-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Admin Sessions</span>
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">
                {stats.onlineAdmins}
              </span>
              <span className="text-xs text-gray-500">Admin online</span>
            </div>
            <span className="text-[11px] text-gray-400 mt-1">Full management access</span>
          </div>

          {/* Tile 3: Online Sales */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#16161a] border border-gray-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Sales Executives</span>
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {stats.onlineSales}
              </span>
              <span className="text-xs text-gray-500">Sales staff online</span>
            </div>
            <span className="text-[11px] text-gray-400 mt-1">Active on store locator/stock</span>
          </div>

          {/* Tile 4: Device Breakdown */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#16161a] border border-gray-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Device Platform</span>
              <Monitor className="w-4 h-4 text-gray-400" />
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm font-bold text-gray-900 dark:text-white">
              <span className="flex items-center gap-1">
                <Laptop className="w-4 h-4 text-blue-500" /> {stats.desktopCount}
              </span>
              <span className="text-gray-300 dark:text-zinc-700">·</span>
              <span className="flex items-center gap-1">
                <Smartphone className="w-4 h-4 text-amber-500" /> {stats.mobileCount}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 mt-1">Desktop vs Mobile active</span>
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Main Tabs */}
          <div className="inline-flex p-1 rounded-2xl bg-gray-100 dark:bg-zinc-900 border border-gray-200/60 dark:border-zinc-800">
            <button
              onClick={() => setTab('live')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                tab === 'live'
                  ? 'bg-white dark:bg-[#1e1e24] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Live Users Now</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {liveSessions.length}
              </span>
            </button>
            <button
              onClick={() => setTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
                tab === 'history'
                  ? 'bg-white dark:bg-[#1e1e24] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span>Audit History</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300">
                {history.length}
              </span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search user, IP, or page..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#16161a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as any)}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#16161a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admins Only</option>
              <option value="SALES">Sales Only</option>
            </select>

            {tab === 'history' && (
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#16161a] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="LOGGED_OUT">Logged Out</option>
                <option value="REVOKED">Revoked / Forced</option>
                <option value="FAILED">Failed Attempts</option>
              </select>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-xs text-gray-500 mt-2">Loading live monitoring data...</p>
          </div>
        )}

        {/* Tab 1: Live Users Table */}
        {!loading && tab === 'live' && (
          <div className="rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#16161a] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[850px]">
                <thead className="bg-gray-50/90 dark:bg-zinc-900/80 border-b border-gray-200/80 dark:border-white/10 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Live Status</th>
                    <th className="py-3 px-4">Current Screen / Path</th>
                    <th className="py-3 px-4">Device & IP</th>
                    <th className="py-3 px-4">Logged In</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredLive.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                        {liveSessions.length === 0 ? 'No users are currently active.' : 'No users match the current search filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredLive.map(s => {
                      const isMe = me?.username === s.username;
                      const isOnline = s.liveStatus === 'ONLINE';

                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/30 transition text-xs"
                        >
                          {/* User info */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                  s.role === 'ADMIN'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                }`}
                              >
                                {s.username.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                  <span>{s.name || s.username}</span>
                                  {isMe && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-gray-500">@{s.username}</div>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {s.role === 'ADMIN' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                <ShieldCheck className="w-3 h-3" /> Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
                                <Users className="w-3 h-3" /> Sales
                              </span>
                            )}
                          </td>

                          {/* Live Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Idle (Away)
                              </span>
                            )}
                          </td>

                          {/* Current Screen */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded border border-blue-200/40 dark:border-blue-900/40">
                              {s.currentPath || '/'}
                            </span>
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              active {timeAgo(s.lastActiveAt)}
                            </div>
                          </td>

                          {/* Device & IP */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-gray-800 dark:text-gray-200 font-medium">
                              {s.deviceType === 'Mobile' ? (
                                <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                              ) : (
                                <Laptop className="w-3.5 h-3.5 text-blue-500" />
                              )}
                              <span>
                                {s.os || 'Unknown OS'} · {s.browser || 'Browser'}
                              </span>
                            </div>
                            <div className="font-mono text-[10px] text-gray-500">
                              {s.ipAddress || 'unknown ip'}
                            </div>
                          </td>

                          {/* Connected Since */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-medium text-gray-800 dark:text-gray-200">
                              {fmtTime(s.loginAt)}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {calcDuration(s.loginAt, null)} ago
                            </div>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 whitespace-nowrap text-center">
                            {isMe ? (
                              <span className="text-[11px] text-gray-400 italic">Current Session</span>
                            ) : (
                              <button
                                onClick={() => handleRevoke(s.id, s.username)}
                                disabled={revokingId === s.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-400 transition disabled:opacity-50"
                                title="Force remote sign-out for this user"
                              >
                                {revokingId === s.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <LogOut className="w-3 h-3" />
                                )}
                                <span>Terminate</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Audit History Table */}
        {!loading && tab === 'history' && (
          <div className="rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#16161a] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[900px]">
                <thead className="bg-gray-50/90 dark:bg-zinc-900/80 border-b border-gray-200/80 dark:border-white/10 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Login Time (IST)</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Environment</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                        No session records match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(s => {
                      const isFailed = s.status === 'FAILED';
                      const isRevoked = s.status === 'REVOKED';
                      const isActive = s.status === 'ACTIVE';

                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-gray-50/60 dark:hover:bg-zinc-800/30 transition text-xs"
                        >
                          {/* User */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-bold text-gray-900 dark:text-white">
                              {s.name || s.username}
                            </div>
                            <div className="text-[11px] text-gray-500">@{s.username}</div>
                          </td>

                          {/* Role */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {s.role === 'ADMIN' ? (
                              <span className="font-semibold text-purple-600 dark:text-purple-400">Admin</span>
                            ) : s.role === 'SALES' ? (
                              <span className="font-semibold text-blue-600 dark:text-blue-400">Sales</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isFailed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                <AlertTriangle className="w-3 h-3" /> Failed: {s.failReason || 'Error'}
                              </span>
                            ) : isRevoked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                <Lock className="w-3 h-3" /> Revoked
                              </span>
                            ) : isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Active Session
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400">
                                Logged Out
                              </span>
                            )}
                          </td>

                          {/* Login Time */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div>{fmtDate(s.loginAt)}</div>
                            {s.endedAt && (
                              <div className="text-[10px] text-gray-400">ended {fmtTime(s.endedAt)}</div>
                            )}
                          </td>

                          {/* Duration */}
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">
                            {isFailed ? '—' : calcDuration(s.loginAt, s.endedAt)}
                          </td>

                          {/* Device / OS */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span>{s.os || 'Unknown OS'}</span> · <span className="text-gray-500">{s.browser || 'Browser'}</span>
                          </td>

                          {/* IP Address */}
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-gray-500">
                            {s.ipAddress || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 max-w-sm flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl animate-fadeInUp ${
            toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1 text-xs">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss">
            <X className="w-4 h-4 opacity-80" />
          </button>
        </div>
      )}
    </div>
  );
}

