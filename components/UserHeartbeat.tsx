'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/lib/useCurrentUser';

export function UserHeartbeat() {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const sendBeat = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return; // Don't ping if tab is in background
      }
      try {
        const res = await fetch('/api/me/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pathname: window.location.pathname }),
        });
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.revoked) {
            window.location.href = '/login?msg=Session+ended+by+administrator';
          }
        }
      } catch {
        // Ignore network glitches
      }
    };

    // Send beat immediately on route change
    sendBeat();

    // Set 45-second heartbeat loop
    timerRef.current = setInterval(sendBeat, 45000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendBeat();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, pathname]);

  return null;
}

