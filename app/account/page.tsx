'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle, Home, KeyRound, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { ROLE_LABEL } from '@/lib/access';
import { PASSWORD_MIN, validatePassword } from '@/lib/userRules';

const field =
  'w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40';

export default function AccountPage() {
  const { user, loading } = useCurrentUser();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const problem = validatePassword(next) ?? (next !== confirm ? 'The new passwords don’t match.' : null);
    if (problem) return setMessage({ ok: false, text: problem });

    setSaving(true);
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not change the password.');
      setMessage({ ok: true, text: 'Password changed. You’ve been signed out of any other devices.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not change the password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b171c] pb-16">
      <header className="bg-white/90 dark:bg-[#0f1e25]/90 backdrop-blur border-b border-gray-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 2xl:px-12 py-3.5 sticky top-0 z-40">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300" aria-label="Back to home">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-extrabold text-gray-950 dark:text-white flex items-center gap-2 truncate">
              <KeyRound className="w-5 h-5 text-blue-600 shrink-0" /> My account
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Home" title="Home" className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:text-blue-600">
              <Home className="w-4 h-4" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 py-6 space-y-5">
        <section className="bg-white dark:bg-[#142830] rounded-3xl p-5 border border-gray-200/80 dark:border-white/10">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : user ? (
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-semibold text-gray-900 dark:text-white">{user.name}</dd>
              <dt className="text-gray-500">Username</dt>
              <dd className="font-mono text-gray-900 dark:text-white">{user.username}</dd>
              <dt className="text-gray-500">Role</dt>
              <dd className="font-semibold text-gray-900 dark:text-white">{ROLE_LABEL[user.role]}</dd>
            </dl>
          ) : (
            <p className="text-sm text-red-600">Couldn’t load your account.</p>
          )}
        </section>

        <form onSubmit={submit} className="bg-white dark:bg-[#142830] rounded-3xl p-5 border border-gray-200/80 dark:border-white/10 space-y-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Change password</h2>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Current password</span>
            <input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={`${field} mt-1`} required />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">New password</span>
            <input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className={`${field} mt-1`} required minLength={PASSWORD_MIN} />
            <span className="text-[11px] text-gray-400">At least {PASSWORD_MIN} characters.</span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Confirm new password</span>
            <input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={`${field} mt-1`} required />
          </label>

          {message && (
            <p role={message.ok ? 'status' : 'alert'} className={`flex items-start gap-1.5 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {message.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
              {message.text}
            </p>
          )}

          <button type="submit" disabled={saving || !current || !next || !confirm} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Change password
          </button>
        </form>
      </main>
    </div>
  );
}
