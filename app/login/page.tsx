'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { resetCurrentUser } from '@/lib/useCurrentUser';
import { isAppPage } from '@/lib/access';
import { LoginMountains } from '@/components/LoginMountains';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#d6d2f7] to-[#8a82e6] dark:from-[#1b1740] dark:to-[#0f0c2e] sm:p-6 lg:p-10">
      <div className="login-frame relative flex w-full max-w-[1100px] items-center justify-center overflow-hidden sm:rounded-[2rem] shadow-[0_30px_80px_-30px_rgba(60,40,160,0.65)] min-h-screen sm:min-h-[600px] sm:h-[min(640px,88vh)] px-4">
        <LoginMountains />

        <div className="login-glass relative z-10 w-full max-w-[320px] rounded-2xl px-7 py-8 text-white">
          <h1 className="text-center text-2xl font-semibold tracking-tight">Login</h1>
          <p className="mt-1 mb-6 text-center text-xs text-white/75">iPlanet Store Locator</p>

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

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-950/40 px-3 py-2 text-xs text-red-100 backdrop-blur">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !username.trim() || !password}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#2f2593] shadow-lg transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
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
  );
}
