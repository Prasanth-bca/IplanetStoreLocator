'use client';

import React, { useId } from 'react';

/**
 * The assistant's face: an original illustration of a friendly iPlanet team member in the store uniform
 * (red t-shirt printed "www.iPlanet.one", smartwatch), waving hello. It is a drawing, not a photo of anyone.
 * The uniform is always red, as in the stores; the background follows the active theme.
 * `waving` plays the hand wave (a few waves, then a rest); it is switched off for people who prefer reduced motion.
 */
export function AssistantAvatar({ size = 64, waving = true, className = '' }: { size?: number; waving?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const clip = `av-clip-${uid}`;
  const bg = `av-bg-${uid}`;
  const SKIN = '#D9A27A';
  const SKIN_SHADE = '#C48863';
  const HAIR = '#1A1210';
  const TEE = '#D7202C';
  const TEE_DARK = '#B3161F';

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="iPlanet assistant waving hello" className={className}>
      <defs>
        <clipPath id={clip}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
        <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'rgb(var(--pal-brand-pale))' }} />
          <stop offset="1" style={{ stopColor: 'rgb(var(--pal-brand-soft))' }} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${clip})`}>
        <rect width="120" height="120" fill={`url(#${bg})`} />
        <circle cx="26" cy="30" r="22" fill="#fff" opacity="0.18" />

        {/* long hair behind the head and shoulders */}
        <path d="M35 60 C32 36 46 25 60 25 C75 25 88 36 85 60 C87 76 85 92 80 100 L40 100 C35 92 33 76 35 60Z" fill={HAIR} />

        {/* body: red uniform t-shirt */}
        <path d="M10 124 C10 98 30 90 47 88 L73 88 C90 90 110 98 110 124Z" fill={TEE} />
        <path d="M73 88 C90 90 110 98 110 124 L88 124 C88 108 82 94 73 88Z" fill={TEE_DARK} opacity="0.35" />

        {/* neck and round neckline */}
        <path d="M53 72 H67 V90 C67 94 53 94 53 90Z" fill={SKIN_SHADE} />
        <path d="M49.5 88 Q60 102 70.5 88Z" fill={SKIN_SHADE} />
        <path d="M48 88 Q60 104 72 88" stroke={TEE_DARK} strokeWidth="2.4" strokeLinecap="round" fill="none" />

        {/* the print on the chest */}
        <text x="55" y="110.5" textAnchor="middle" fontSize="5.2" fontWeight="700" fill="#fff" fontFamily="Inter, Arial, sans-serif" textLength="40" lengthAdjust="spacingAndGlyphs">www.iPlanet.one</text>

        {/* head */}
        <ellipse cx="60" cy="56" rx="19" ry="22" fill={SKIN} />
        {/* side-parted fringe */}
        <path d="M40.5 55 C38.5 37 50 29.5 62 30.5 C74 31.5 82 41 80 55 C75.5 45 66 40.5 56 42 C49 43 44 47 40.5 55Z" fill={HAIR} />
        {/* long locks falling in front of the shoulders */}
        <path d="M38.5 56 C35 70 36 86 41 99 C47 96 49.5 88 50 80 C47 76 44.5 70 42 62Z" fill={HAIR} />
        <path d="M81.5 56 C85 70 84 86 79 99 C73 96 70.5 88 70 80 C73 76 75.5 70 78 62Z" fill={HAIR} />
        {/* eyebrows, eyes, cheeks, smile */}
        <path d="M47 50.5 Q52 47.5 57 50" stroke={HAIR} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <path d="M63 50 Q68 47.5 73 50.5" stroke={HAIR} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <ellipse cx="52" cy="57" rx="2.6" ry="3" fill="#2A1A14" />
        <ellipse cx="68" cy="57" rx="2.6" ry="3" fill="#2A1A14" />
        <circle cx="52.9" cy="56" r="0.9" fill="#fff" />
        <circle cx="68.9" cy="56" r="0.9" fill="#fff" />
        <circle cx="49.5" cy="65" r="3.6" fill="#E58C7C" opacity="0.35" />
        <circle cx="70.5" cy="65" r="3.6" fill="#E58C7C" opacity="0.35" />
        <path d="M60 58 q-1.4 5 0.6 6" stroke={SKIN_SHADE} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <path d="M51.5 67.5 Q60 77 68.5 67.5 Q60 70.5 51.5 67.5Z" fill="#fff" stroke="#B5503F" strokeWidth="1.6" strokeLinejoin="round" />

        {/* waving arm (kept inside the circle): short red sleeve, bare forearm; the forearm and hand swing from the elbow */}
        <g transform="translate(-8 0)">
          <path d="M92 104 L103 88" stroke={SKIN} strokeWidth="11" strokeLinecap="round" fill="none" />
          <path d="M90 107 L97.5 96.5" stroke={TEE} strokeWidth="15" strokeLinecap="round" fill="none" />
          <g className={waving ? 'avatar-wave' : undefined}>
            <path d="M103 88 L106 62" stroke={SKIN} strokeWidth="10.5" strokeLinecap="round" fill="none" />
            {/* smartwatch, like the team wears */}
            <rect x="99.8" y="60" width="12.4" height="6.4" rx="2" fill="#1F2937" />
            <rect x="102" y="60.6" width="8" height="5.2" rx="1.6" fill="#0B0F19" />
            <rect x="103.2" y="62" width="5.6" height="1.2" rx="0.6" fill="#5EEAD4" opacity="0.9" />
            {/* hand */}
            <ellipse cx="106" cy="52" rx="7.2" ry="8.4" fill={SKIN} />
            <rect x="99.4" y="36" width="3.6" height="13" rx="1.8" fill={SKIN} transform="rotate(-10 101 49)" />
            <rect x="103.6" y="33.5" width="3.8" height="15" rx="1.9" fill={SKIN} />
            <rect x="108" y="35" width="3.6" height="14" rx="1.8" fill={SKIN} transform="rotate(8 110 49)" />
            <rect x="111.6" y="39" width="3.2" height="11" rx="1.6" fill={SKIN} transform="rotate(18 113 50)" />
            <rect x="96.6" y="49" width="3.8" height="10" rx="1.9" fill={SKIN} transform="rotate(-48 98 55)" />
          </g>
        </g>
      </g>
    </svg>
  );
}
