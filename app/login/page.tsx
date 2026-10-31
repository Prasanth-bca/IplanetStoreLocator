'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { resetCurrentUser } from '@/lib/useCurrentUser';
import { isAppPage } from '@/lib/access';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // e.g. "Your session was ended by an administrator." when the heartbeat sent them here
  const notice = (searchParams.get('msg') || '').slice(0, 120);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Login failed');
        setIsSubmitting(false);
        return;
      }

      resetCurrentUser(); // so the next page asks who just signed in
      // Only follow real pages of this site: never another website, never an address that doesn't exist.
      const requested = searchParams.get('next') || '/';
      const next = requested.startsWith('/') && !requested.startsWith('//') && isAppPage(requested) ? requested : '/';
      router.push(next);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-frame relative min-h-screen w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/login-hero.jpg" alt="" aria-hidden className="login-photo absolute inset-0 h-full w-full object-cover" />
      <div aria-hidden className="login-photo-tint absolute inset-0" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col justify-end gap-6 px-6 py-8 sm:px-10 lg:grid lg:grid-cols-2 lg:gap-12 lg:px-16 lg:py-14">
        {/* title: sits low on every screen so the agent's face stays clear */}
        <header className="login-title flex flex-col justify-end text-white">
          <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur-md">
            iPlanet · AI Store Locator
          </span>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl xl:text-7xl">
            Customer Experience Centre
          </h1>
          <p className="mt-3 max-w-md text-sm text-white/85 drop-shadow sm:text-base">Sign in to find stores, check stock and share offers with customers.</p>
        </header>

        <div className="flex items-center justify-center lg:justify-end lg:pr-[4%]">
          <div className="login-glass w-full max-w-[340px] rounded-2xl px-7 py-8 text-white">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Login</h2>
            <p className="mt-1 mb-6 text-center text-xs text-white/75">Use your iPlanet account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="relative block">
              <span className="sr-only">Username</span>
              <input
                type="text"
                autoFocus
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                className="login-field"
              />
              <User className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
            </label>

            <label className="relative block">
              <span className="sr-only">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="login-field"
              />
              <Lock className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
            </label>

            {notice && !error && (
              <div role="status" className="rounded-xl border border-white/40 bg-white/15 px-3 py-2 text-xs text-white backdrop-blur">{notice}</div>
            )}

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-950/40 px-3 py-2 text-xs text-red-100 backdrop-blur">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !username.trim() || !password}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 login-submit rounded-full px-4 py-3 text-sm font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
