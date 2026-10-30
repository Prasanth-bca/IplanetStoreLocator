/** Layered mountain landscape for the sign-in frame: sky, drifting clouds, birds, ridges and a pine forest. Decoration only. */

// Deterministic pine-tree skyline (no Math.random, so server and browser render the same markup).
function forest(seed: number, baseY: number, count: number, minH: number, maxH: number): string {
  let x = -20;
  let r = seed;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  let d = `M-20 ${baseY + 80} L-20 ${baseY} `;
  for (let i = 0; i < count; i++) {
    const w = 10 + rnd() * 16;
    const h = minH + rnd() * (maxH - minH);
    const gap = 3 + rnd() * 8;
    d += `L${x.toFixed(1)} ${baseY} L${(x + w / 2).toFixed(1)} ${(baseY - h).toFixed(1)} L${(x + w).toFixed(1)} ${baseY} `;
    x += w + gap;
    if (x > 1040) break;
  }
  return d + `L1040 ${baseY} L1040 ${baseY + 80} Z`;
}

export function LoginMountains() {
  return (
    <svg aria-hidden className="login-mtn absolute inset-0 h-full w-full" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="mtn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ls-sky-1)' }} />
          <stop offset="0.35" style={{ stopColor: 'var(--ls-sky-2)' }} />
          <stop offset="0.6" style={{ stopColor: 'var(--ls-sky-3)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ls-sky-4)' }} />
        </linearGradient>
        <linearGradient id="mtn-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ls-far-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ls-far-b)' }} />
        </linearGradient>
        <linearGradient id="mtn-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ls-mid-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ls-mid-b)' }} />
        </linearGradient>
        <linearGradient id="mtn-peak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ls-peak-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ls-peak-b)' }} />
        </linearGradient>
        <linearGradient id="mtn-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--ls-near-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--ls-near-b)' }} />
        </linearGradient>
        <filter id="mtn-soft" x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <rect width="1000" height="600" fill="url(#mtn-sky)" />

      {/* a low sun; only palettes that set --ls-sun show it */}
      <circle cx="250" cy="215" r="62" style={{ fill: 'var(--ls-sun, transparent)' }} filter="url(#mtn-soft)" />

      {/* clouds */}
      <g style={{ fill: 'var(--ls-cloud)' }} opacity="0.7" filter="url(#mtn-soft)">
        <g className="mtn-cloud mtn-cloud-a">
          <ellipse cx="170" cy="70" rx="190" ry="26" />
          <ellipse cx="300" cy="105" rx="150" ry="18" />
        </g>
        <g className="mtn-cloud mtn-cloud-b" opacity="0.8">
          <ellipse cx="760" cy="60" rx="200" ry="24" />
          <ellipse cx="640" cy="118" rx="170" ry="16" />
        </g>
      </g>

      {/* birds */}
      <g fill="none" style={{ stroke: 'var(--ls-bird)' }} strokeWidth="2" strokeLinecap="round">
        <path className="mtn-bird" d="M690 88 q8 -8 16 0 q8 -8 16 0" style={{ animationDelay: '0s' }} />
        <path className="mtn-bird" d="M610 118 q5 -5 10 0 q5 -5 10 0" style={{ animationDelay: '1.4s' }} />
        <path className="mtn-bird" d="M840 140 q4 -4 8 0 q4 -4 8 0" style={{ animationDelay: '2.6s' }} />
      </g>

      {/* ridges, far to near */}
      <path fill="url(#mtn-far)" d="M0 250 L90 215 L170 235 L260 195 L350 240 L430 225 L520 262 L600 215 L690 245 L760 205 L840 240 L930 215 L1000 240 L1000 460 L0 460 Z" />
      <path fill="url(#mtn-mid)" d="M0 330 L70 270 L130 290 L210 230 L300 270 L390 300 L470 285 L560 330 L650 360 L1000 360 L1000 480 L0 480 Z" opacity="0.95" />
      <path fill="url(#mtn-peak)" d="M610 600 L650 360 L700 250 L735 215 L760 160 L790 115 L820 150 L850 205 L880 190 L935 240 L1000 300 L1000 600 Z" />
      <path style={{ fill: 'var(--ls-near-a)' }} opacity="0.55" d="M790 115 L820 150 L850 205 L880 190 L860 330 L800 600 L760 600 L790 300 L775 200 Z" />
      <path fill="url(#mtn-peak)" d="M0 600 L0 330 L60 285 L120 300 L180 350 L250 340 L330 395 L420 430 L500 600 Z" />
      <path fill="url(#mtn-near)" d="M0 600 L0 400 L90 390 L190 440 L300 430 L420 480 L560 470 L700 430 L820 450 L1000 420 L1000 600 Z" />

      {/* forest, back row lighter then front row dark */}
      <path style={{ fill: 'var(--ls-forest-1)' }} d={forest(7, 500, 44, 20, 46)} />
      <path style={{ fill: 'var(--ls-forest-2)' }} d={forest(21, 545, 52, 26, 70)} />
      <path style={{ fill: 'var(--ls-forest-3)' }} d="M0 590 H1000 V600 H0 Z" />
    </svg>
  );
}
