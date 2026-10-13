'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Loader2, AlertCircle } from 'lucide-react';

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
        body: JSON.stringify({ password })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Login failed');
        setIsSubmitting(false);
        return;
      }

      const next = searchParams.get('next') || '/';
      router.push(next);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbfbfd] dark:bg-[#0a0a0c] text-gray-900 dark:text-gray-100 px-4 transition-colors duration-200">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-[#16161a] rounded-3xl p-8 border border-gray-200/80 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 mb-5">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>

          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1">
            iPlanet Store Locator
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Enter the password to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                autoFocus
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold shadow-sm transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
