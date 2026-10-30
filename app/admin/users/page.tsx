'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle, Copy, Home, Loader2, Pencil, Plus, ShieldCheck, UserCheck, UserX, Users, X, KeyRound } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { ROLE_LABEL, ROLES, Role } from '@/lib/access';
import { PASSWORD_MIN } from '@/lib/userRules';

interface UserRow {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  leadCount: number;
}

type Dialog =
  | { kind: 'create' }
  | { kind: 'edit'; user: UserRow }
  | { kind: 'password'; user: UserRow }
  | { kind: 'toggle'; user: UserRow }
  | { kind: 'credentials'; username: string; password: string; name: string; reset: boolean };

const field =
  'w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40';

/** A readable random password, avoiding look-alike characters (0/O, 1/l/I). */
function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

const fmtLogin = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never';

export default function UsersAdminPage() {
  const { user: me } = useCurrentUser();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load users');
      setUsers(data.users);
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : 'Could not load users' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.ok ? 3500 : 6000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b171c] pb-16">
      <header className="bg-white/90 dark:bg-[#0f1e25]/90 backdrop-blur border-b border-gray-200 dark:border-white/10 px-4 sm:px-6 lg:px-8 2xl:px-12 py-3.5 sticky top-0 z-40">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin" className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300" aria-label="Back to admin">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-extrabold text-gray-950 dark:text-white flex items-center gap-2 truncate">
              <Users className="w-5 h-5 text-sky-600 shrink-0" /> Users
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/sessions"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40 text-xs font-bold hover:bg-emerald-100 transition"
              title="View live active users and login session history"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline">Live Monitoring</span>
            </Link>
            <button onClick={() => setDialog({ kind: 'create' })} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
              <Plus className="w-4 h-4" /> Add user
            </button>
            <Link href="/" aria-label="Home" title="Home" className="p-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:text-blue-600">
              <Home className="w-4 h-4" />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 py-6 space-y-4">
        <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50 px-4 py-3 text-sm text-sky-900 dark:text-sky-200 flex gap-2.5">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            <strong>Admins</strong> can use everything. <strong>Sales users</strong> can use the Store Finder, view Stock and Products, and see only their own passed leads.
          </p>
        </div>

        {loading && (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-white dark:bg-[#142830] border border-gray-100 dark:border-white/10 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && users.length > 0 && (
          <div className="bg-white dark:bg-[#142830] rounded-3xl border border-gray-200/80 dark:border-white/10 overflow-hidden">
            <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_120px_120px_70px_130px] gap-4 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100 dark:border-white/10">
              <span>Person</span>
              <span>Role</span>
              <span>Last sign-in</span>
              <span className="text-right">Leads</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {users.map(u => {
                const isMe = u.id === me?.id;
                return (
                  <li key={u.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_120px_120px_70px_130px] items-center gap-x-4 gap-y-2 px-5 py-3">
                    <div className={`min-w-0 ${u.active ? '' : 'opacity-55'}`}>
                      <div className="text-sm font-bold text-gray-950 dark:text-white truncate">
                        {u.name} {isMe && <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 align-middle">You</span>}
                      </div>
                      <div className="text-xs font-mono text-gray-500 truncate">{u.username}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${u.role === 'ADMIN' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/60' : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-zinc-700'}`}>
                        {ROLE_LABEL[u.role]}
                      </span>
                      {!u.active && <span className="text-[11px] font-bold text-red-600">Disabled</span>}
                    </div>
                    <div className="text-xs text-gray-500">{fmtLogin(u.lastLoginAt)}</div>
                    <div className="md:text-right text-sm font-bold text-gray-900 dark:text-white">
                      {u.leadCount}
                      <span className="md:hidden text-xs font-normal text-gray-500"> {u.leadCount === 1 ? 'lead' : 'leads'}</span>
                    </div>
                    <div className="flex items-center md:justify-end gap-1">
                      <button onClick={() => setDialog({ kind: 'edit', user: u })} aria-label={`Edit ${u.name}`} title="Edit name and role" className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDialog({ kind: 'password', user: u })} aria-label={`Reset password for ${u.name}`} title="Reset password" className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => (u.active ? setDialog({ kind: 'toggle', user: u }) : toggleActive(u, true))}
                        disabled={isMe}
                        aria-label={`${u.active ? 'Disable' : 'Enable'} ${u.name}`}
                        title={isMe ? 'You can’t disable your own account' : u.active ? 'Disable account' : 'Enable account'}
                        className="p-2 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-500 disabled:cursor-not-allowed"
                      >
                        {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4 text-emerald-600" />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>

      {dialog && <UserDialog dialog={dialog} me={me?.id} onClose={() => setDialog(null)} onChanged={async (next, message) => { setDialog(next); if (message) setToast({ ok: true, text: message }); await load(); }} />}

      {toast && (
        <div role="status" className={`fixed top-20 right-4 z-[60] max-w-sm flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss"><X className="w-4 h-4 opacity-80" /></button>
        </div>
      )}
    </div>
  );

  async function toggleActive(u: UserRow, active: boolean) {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setToast({ ok: true, text: `${u.name} ${active ? 'enabled' : 'disabled'}.` });
      await load();
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : 'Update failed' });
    }
  }
}

function UserDialog({ dialog, me, onClose, onChanged }: { dialog: Dialog; me?: string; onClose: () => void; onChanged: (next: Dialog | null, message?: string) => Promise<void> }) {
  const [name, setName] = useState(dialog.kind === 'edit' ? dialog.user.name : '');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>(dialog.kind === 'edit' ? dialog.user.role : 'SALES');
  const [password, setPassword] = useState(() => (dialog.kind === 'create' || dialog.kind === 'password' ? generatePassword() : ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function call(url: string, method: string, body: unknown): Promise<any> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      return null;
    } finally {
      setBusy(false);
    }
  }

  const shell = (title: string, body: React.ReactNode, footer: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] sm:p-4 animate-fadeIn" onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label={title}>
      <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-[#142830] w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl animate-fadeInUp">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-extrabold text-gray-950 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -mr-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">{body}</div>
        <div className="px-5 pb-5 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
  const cancel = <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200">Cancel</button>;
  const primary = (label: string, disabled = false, danger = false) => (
    <button type="submit" disabled={busy || disabled} className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" />} {label}
    </button>
  );
  const err = error && <p role="alert" className="text-sm text-red-600 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</p>;

  const passwordField = (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{dialog.kind === 'create' ? 'Temporary password' : 'New password'}</span>
      <div className="mt-1 flex gap-2">
        <input value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" spellCheck={false} className={`${field} font-mono`} />
        <button type="button" onClick={() => setPassword(generatePassword())} className="shrink-0 px-3 rounded-xl text-xs font-bold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200">Generate</button>
      </div>
      <span className="text-[11px] text-gray-400">At least {PASSWORD_MIN} characters. Share it with them securely; they can change it from My account.</span>
    </label>
  );

  if (dialog.kind === 'credentials') {
    const text = `Username: ${dialog.username}\nPassword: ${dialog.password}`;
    return shell(
      dialog.reset ? 'Password reset' : 'User created',
      <>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {dialog.reset ? `${dialog.name} was signed out everywhere.` : `${dialog.name} can now sign in.`} <strong>This password is shown only now</strong>, so copy it and share it with them.
        </p>
        <pre className="text-sm font-mono bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 whitespace-pre-wrap">{text}</pre>
        <button type="button" onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-xs font-bold">
          <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy details'}
        </button>
      </>,
      <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">Done</button>
    );
  }

  if (dialog.kind === 'create') {
    return (
      <form onSubmit={async e => { e.preventDefault(); const d = await call('/api/admin/users', 'POST', { name, username, role, password }); if (d) await onChanged({ kind: 'credentials', username: d.user.username, password, name: d.user.name, reset: false }); }}>
        {shell('Add user',
          <>
            <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Full name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={80} className={`${field} mt-1`} /></label>
            <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Username</span><input value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" spellCheck={false} placeholder="e.g. priya.s" maxLength={32} className={`${field} mt-1 font-mono`} /></label>
            <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Role</span>
              <select value={role} onChange={e => setRole(e.target.value as Role)} className={`${field} mt-1`}>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
            </label>
            {passwordField}
            {err}
          </>,
          <>{cancel}{primary('Create user', !name.trim() || !username.trim() || password.length < PASSWORD_MIN)}</>
        )}
      </form>
    );
  }

  if (dialog.kind === 'edit') {
    const u = dialog.user;
    const isMe = u.id === me;
    const roleChanged = role !== u.role;
    return (
      <form onSubmit={async e => { e.preventDefault(); const d = await call(`/api/admin/users/${u.id}`, 'PATCH', { name, ...(roleChanged ? { role } : {}) }); if (d) await onChanged(null, `Saved ${name.trim()}.`); }}>
        {shell(`Edit ${u.name}`,
          <>
            <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Full name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} maxLength={80} className={`${field} mt-1`} /></label>
            <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Role</span>
              <select value={role} onChange={e => setRole(e.target.value as Role)} disabled={isMe} className={`${field} mt-1 disabled:opacity-60`}>{ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
              {isMe && <span className="text-[11px] text-gray-400">You can’t change your own role.</span>}
            </label>
            {roleChanged && <p className="text-xs text-amber-700 dark:text-amber-300">Changing the role signs {u.name} out of all their sessions.</p>}
            {err}
          </>,
          <>{cancel}{primary('Save changes', !name.trim())}</>
        )}
      </form>
    );
  }

  if (dialog.kind === 'password') {
    const u = dialog.user;
    return (
      <form onSubmit={async e => { e.preventDefault(); const d = await call(`/api/admin/users/${u.id}`, 'PATCH', { password }); if (d) await onChanged({ kind: 'credentials', username: u.username, password, name: u.name, reset: true }); }}>
        {shell(`Reset password for ${u.name}`, <>{passwordField}<p className="text-xs text-amber-700 dark:text-amber-300">They’ll be signed out everywhere and must use the new password.</p>{err}</>, <>{cancel}{primary('Reset password', password.length < PASSWORD_MIN)}</>)}
      </form>
    );
  }

  const u = dialog.user;
  return (
    <form onSubmit={async e => { e.preventDefault(); const d = await call(`/api/admin/users/${u.id}`, 'PATCH', { active: false }); if (d) await onChanged(null, `${u.name} disabled.`); }}>
      {shell(`Disable ${u.name}?`, <><p className="text-sm text-gray-600 dark:text-gray-300">They’ll be signed out right away and won’t be able to sign in. Their lead history is kept, and you can enable them again later.</p>{err}</>, <>{cancel}{primary('Disable', false, true)}</>)}
    </form>
  );
}
