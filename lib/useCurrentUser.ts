'use client';

import { useEffect, useState } from 'react';
import type { Role } from '@/lib/access';

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

let cached: CurrentUser | null = null;
let inflight: Promise<CurrentUser | null> | null = null;

function load(): Promise<CurrentUser | null> {
  inflight ??= fetch('/api/me')
    .then(res => (res.ok ? (res.json() as Promise<CurrentUser>) : null))
    .catch(() => null)
    .then(user => {
      cached = user;
      inflight = null;
      return user;
    });
  return inflight;
}

// Components that stay mounted across a sign-in or sign-out (the chat button, the heartbeat, store alerts) must hear about it.
const listeners = new Set<() => void>();

/** Forget the cached person, e.g. after signing in or out, and tell every component using the hook to ask again. */
export function resetCurrentUser() {
  cached = null;
  inflight = null;
  listeners.forEach(run => run());
}

/** The signed-in person; `loading` is true until the first answer arrives. */
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(cached);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cached) {
        setUser(cached);
        setLoading(false);
        return;
      }
      load().then(u => {
        if (cancelled) return;
        setUser(u);
        setLoading(false);
      });
    };
    run();
    listeners.add(run);
    return () => {
      cancelled = true;
      listeners.delete(run);
    };
  }, []);

  return { user, loading };
}
