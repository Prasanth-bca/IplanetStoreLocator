import React, { useId } from 'react';

/**
 * The app's logo: an original drawing of a silver apple cut in half along a lightning bolt.
 * The two halves sit slightly apart, and the gap between them is the thunder. It is meant for a dark background.
 */
const APPLE = 'M32 17 C26.5 11.5 12.5 12.5 10.5 28 C9 40 15.5 56 25 57.5 C28.5 58 30 56.2 32 56.2 C34 56.2 35.5 58 39 57.5 C48.5 56 55 40 53.5 28 C51.5 12.5 37.5 11.5 32 17Z';
/** The zigzag the apple is cut along, top to bottom (it runs past the apple at both ends). */
const CUT: [number, number][] = [[36, 4], [29, 22], [36, 30], [28, 42], [35, 50], [31, 64]];
const SHIFT = { x: 4.5, y: 1.5 };

const pts = (a: [number, number][]) => a.map(([x, y]) => `${x},${y}`).join(' ');
const LEFT = pts([[0, 0], [36, 0], ...CUT, [0, 64]]);
const RIGHT = pts([[64, 0], [36, 0], ...CUT, [64, 64]]);
// the gap between the halves is the bolt: down the cut, back up the shifted cut
const BOLT = pts([...CUT, ...CUT.map(([x, y]) => [x + SHIFT.x, y + SHIFT.y] as [number, number]).reverse()]);

export function BrandMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `bm-${n}-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="iPlanet CEC Connect logo" className={className}>
      <defs>
        <linearGradient id={id('l')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#CBD1DB" />
          <stop offset="1" stopColor="#8F98A8" />
        </linearGradient>
        <linearGradient id={id('r')} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EEF1F6" />
          <stop offset="0.5" stopColor="#B4BBC8" />
          <stop offset="1" stopColor="#7C8696" />
        </linearGradient>
        <linearGradient id={id('b')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#BFE6FF" />
        </linearGradient>
        <linearGradient id={id('leaf')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4F6FA" />
          <stop offset="1" stopColor="#A9B1BF" />
        </linearGradient>
        <clipPath id={id('cl')}>
          <polygon points={LEFT} />
        </clipPath>
        <clipPath id={id('cr')}>
          <polygon points={RIGHT} />
        </clipPath>
        {/* the bolt only exists inside the apple: it is trimmed to the apple's outline */}
        <clipPath id={id('cu')}>
          <path d={APPLE} />
          <path d={APPLE} transform={`translate(${SHIFT.x} ${SHIFT.y})`} />
        </clipPath>
        <filter id={id('glow')} x="-40%" y="-20%" width="180%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.3" floodColor="#BFE6FF" floodOpacity="0.95" />
        </filter>
      </defs>

      {/* the thunder: the gap between the two halves */}
      <g clipPath={`url(#${id('cu')})`}>
        <polygon points={BOLT} fill={`url(#${id('b')})`} filter={`url(#${id('glow')})`} />
      </g>

      {/* left half, then right half (moved down and across) */}
      <g clipPath={`url(#${id('cl')})`}>
        <path d={APPLE} fill={`url(#${id('l')})`} />
      </g>
      <g transform={`translate(${SHIFT.x} ${SHIFT.y})`}>
        <g clipPath={`url(#${id('cr')})`}>
          <path d={APPLE} fill={`url(#${id('r')})`} />
        </g>
      </g>

      {/* sheen on the left half, stem and leaf */}
      <path d="M14.6 27 C15.6 22.4 18.4 19.6 21.8 18.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M32 17.5 C32.4 13.8 33.6 11 35.6 8.6" stroke="#8A93A3" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M35.8 11.2 C37.6 6.6 43.4 5.4 46.6 7 C45.6 11.8 40.4 14 35.8 11.2Z" fill={`url(#${id('leaf')})`} />
    </svg>
  );
}
