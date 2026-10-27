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

/** Forget the cached person, e.g. after signing out. */
export function resetCurrentUser() {
  cached = null;
  inflight = null;
}

/** The signed-in person; `loading` is true until the first answer arrives. */
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(cached);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    load().then(u => {
      if (cancelled) return;
      setUser(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
}
