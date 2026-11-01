'use client';

import React, { useEffect, useState } from 'react';

/** The photos behind the sign-in form. `pos` keeps each face in frame on a wide screen, `posNarrow` on a phone. */
const SLIDES = [
  { src: '/images/login-hero.jpg', pos: '40% 8%', posNarrow: '38% 0%' },
  { src: '/images/login-hero-2.jpg', pos: '30% 22%', posNarrow: '28% 10%' },
  { src: '/images/login-hero-3.jpg', pos: '30% 14%', posNarrow: '30% 6%' },
];
const INTERVAL_MS = 10_000;

/**
 * Full-screen photo slideshow: every 10 seconds the next photo fades in, looping forever.
 * A thin progress bar in the bottom-right corner fills over those 10 seconds so people can see the next change coming.
 * Pauses while the tab is hidden, and shows a single still photo for people who asked for reduced motion.
 */
export function LoginSlideshow() {
  const [index, setIndex] = useState(0);
  // Bumped whenever the countdown restarts (a tab coming back into view) so the bar restarts in step with the timer.
  const [epoch, setEpoch] = useState(0);
  const [still, setStill] = useState(false);
  // The extra photos are fetched only after the first one is on screen, so the sign-in page itself is never slowed down.
  const [loadRest, setLoadRest] = useState(false);

  useEffect(() => {
    setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Start fetching the other photos once the page has finished loading (plus a moment), never before.
  useEffect(() => {
    if (still) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      t = setTimeout(() => setLoadRest(true), 1200);
    };
    if (document.readyState === 'complete') go();
    else window.addEventListener('load', go, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('load', go);
    };
  }, [still]);

  useEffect(() => {
    if (still) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setIndex((i) => (i + 1) % SLIDES.length);
        start();
      }, INTERVAL_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setEpoch((e) => e + 1);
        start();
      } else {
        clearTimeout(timer);
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [still]);

  return (
    <>
      {SLIDES.map((s, i) =>
        i > 0 && (still || !loadRest) ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={s.src}
            alt=""
            aria-hidden
            decoding="async"
            className={`login-photo login-slide absolute inset-0 h-full w-full object-cover ${i === index ? 'is-active' : ''}`}
            style={{ ['--pos' as string]: s.pos, ['--pos-narrow' as string]: s.posNarrow }}
          />
        )
      )}

      {!still && (
        <div aria-hidden className="pointer-events-none absolute bottom-4 right-4 z-20 h-[3px] w-20 overflow-hidden rounded-full bg-white/25 sm:bottom-6 sm:right-8 sm:w-28">
          <span key={`${index}-${epoch}`} className="login-progress block h-full w-full origin-left rounded-full bg-white/90" style={{ animationDuration: `${INTERVAL_MS}ms` }} />
        </div>
      )}
    </>
  );
}
