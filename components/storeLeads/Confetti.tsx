'use client';

import React, { useEffect, useRef } from 'react';

const COLORS = ['#34D399', '#FBBF24', '#60A5FA', '#F472B6', '#A78BFA', '#F87171'];

/** A short burst of confetti for a converted lead. A canvas drawn over the page that ignores clicks and removes itself. Skipped for people who prefer reduced motion. */
export function Confetti({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(onDone, 200);
      return () => clearTimeout(t);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const bits = Array.from({ length: 140 }, (_, i) => ({
      x: innerWidth * (0.25 + Math.random() * 0.5),
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -6 - Math.random() * 10,
      g: 0.28 + Math.random() * 0.12,
      s: 5 + Math.random() * 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      c: COLORS[i % COLORS.length],
    }));
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.vy += b.g;
        b.vx *= 0.995;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - (t - 1800) / 1200);
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      }
      if (t < 3000) raf = requestAnimationFrame(frame);
      else onDone();
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [onDone]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[120] h-full w-full" />;
}
