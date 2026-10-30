/** Animated SVG scene behind the sign-in card: soft glowing blobs, radar rings, a travelling route and floating map pins. Decoration only. */
export function LoginBackdrop() {
  return (
    <div aria-hidden className="login-scene pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft colour glows that drift slowly */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="login-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="70" />
          </filter>
          <filter id="login-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <linearGradient id="login-route" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6C5FDC" stopOpacity="0" />
            <stop offset="0.5" stopColor="#6C5FDC" stopOpacity="0.9" />
            <stop offset="1" stopColor="#1F1B45" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="login-ring" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.6" stopColor="#6C5FDC" stopOpacity="0" />
            <stop offset="1" stopColor="#6C5FDC" stopOpacity="0.55" />
          </radialGradient>
        </defs>

        <g filter="url(#login-blur)">
          <circle className="login-blob login-blob-a" cx="260" cy="200" r="230" fill="#6C5FDC" />
          <circle className="login-blob login-blob-b" cx="980" cy="260" r="210" fill="#7B6FE6" />
          <circle className="login-blob login-blob-c" cx="760" cy="680" r="240" fill="#1F1B45" />
          <circle className="login-blob login-blob-d" cx="170" cy="640" r="170" fill="#A89EF2" />
        </g>

        {/* faint map grid */}
        <g className="login-grid" filter="url(#login-soft)" stroke="currentColor" strokeWidth="1" fill="none">
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="800" />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 100} x2="1200" y2={i * 100} />
          ))}
        </g>

        {/* radar rings expanding from two "stores" */}
        {[
          { x: 300, y: 520, d: '0s' },
          { x: 900, y: 300, d: '1.8s' },
        ].map((s) => (
          <g key={s.x} filter="url(#login-soft)" transform={`translate(${s.x} ${s.y})`}>
            {[0, 1, 2].map((i) => (
              <circle key={i} r="90" fill="url(#login-ring)" className="login-pulse" style={{ animationDelay: `calc(${s.d} + ${i * 1.2}s)` }} />
            ))}
            <circle r="5" fill="#6C5FDC" />
          </g>
        ))}

        {/* dashed route that keeps travelling between the stores */}
        <path className="login-dash" d="M300 520 C 420 360, 560 620, 700 430 S 860 330, 900 300" fill="none" stroke="url(#login-route)" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 14" />
      </svg>

      {/* line-art that draws itself, then erases, on a loop */}
      <svg className="login-art absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <defs>
          <linearGradient id="login-ink" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6C5FDC" />
            <stop offset="1" stopColor="#7B6FE6" />
          </linearGradient>
          <filter id="login-ink-blur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.9" />
          </filter>
        </defs>
        <g stroke="url(#login-ink)" strokeWidth="2.5" filter="url(#login-ink-blur)">
          {/* storefront */}
          <g transform="translate(70 470)">
            <path pathLength="1" className="login-draw" style={{ animationDelay: '0s' }} d="M0 60 L20 0 H200 L220 60 Z" />
            <path pathLength="1" className="login-draw" style={{ animationDelay: '0.3s' }} d="M0 60 q18 26 36 0 q18 26 36 0 q18 26 36 0 q18 26 36 0 q18 26 36 0 q18 26 36 0" />
            <path pathLength="1" className="login-draw" style={{ animationDelay: '0.6s' }} d="M16 86 V210 H204 V86" />
            <path pathLength="1" className="login-draw" style={{ animationDelay: '0.9s' }} d="M44 210 V130 H100 V210 M124 130 H180 V176 H124 Z" />
          </g>
          {/* phone */}
          <g transform="translate(930 430)">
            <rect pathLength="1" className="login-draw" style={{ animationDelay: '1.2s' }} x="0" y="0" width="120" height="240" rx="26" />
            <path pathLength="1" className="login-draw" style={{ animationDelay: '1.6s' }} d="M44 16 H76" />
            <circle pathLength="1" className="login-draw" style={{ animationDelay: '2s' }} cx="60" cy="108" r="28" />
            <path pathLength="1" className="login-draw" style={{ animationDelay: '2.3s' }} d="M40 170 H80 M48 190 H72" />
          </g>
          {/* big pin */}
          <g transform="translate(560 90)">
            <path pathLength="1" className="login-draw" style={{ animationDelay: '2.6s' }} d="M40 0 C18 0 0 17 0 39 C0 68 40 108 40 108 S80 68 80 39 C80 17 62 0 40 0 Z" />
            <circle pathLength="1" className="login-draw" style={{ animationDelay: '3s' }} cx="40" cy="38" r="14" />
          </g>
          {/* compass */}
          <g transform="translate(150 150)">
            <circle pathLength="1" className="login-draw" style={{ animationDelay: '1.8s' }} cx="0" cy="0" r="52" />
            <path pathLength="1" className="login-draw" style={{ animationDelay: '2.2s' }} d="M0 -36 L12 0 L0 36 L-12 0 Z M-36 0 H36" />
          </g>
          {/* winding road across the screen */}
          <path pathLength="1" className="login-draw login-draw-slow" style={{ animationDelay: '0.4s' }} d="M-20 740 C 220 640, 380 780, 600 690 S 980 610, 1220 700" />
          <path pathLength="1" className="login-draw login-draw-slow" style={{ animationDelay: '1.4s' }} d="M-20 120 C 200 60, 420 200, 700 120 S 1040 40, 1220 130" />
        </g>
      </svg>

      {/* floating pins */}
      {[
        { l: '12%', t: '22%', s: 38, d: '0s' },
        { l: '82%', t: '18%', s: 30, d: '1.3s' },
        { l: '72%', t: '72%', s: 42, d: '2.1s' },
        { l: '20%', t: '74%', s: 28, d: '0.7s' },
        { l: '50%', t: '10%', s: 24, d: '2.8s' },
      ].map((p, i) => (
        <svg key={i} viewBox="0 0 24 32" className="login-pin absolute" style={{ left: p.l, top: p.t, width: p.s, animationDelay: p.d }}>
          <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.3 12 32 12 32s12-11.7 12-20.3C24 5.2 18.6 0 12 0Z" fill="url(#login-pin-grad)" />
          <circle cx="12" cy="11.5" r="4.5" fill="#fff" fillOpacity=".9" />
          <defs>
            <linearGradient id="login-pin-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7B6FE6" />
              <stop offset="1" stopColor="#4A3DC0" />
            </linearGradient>
          </defs>
        </svg>
      ))}
    </div>
  );
}
