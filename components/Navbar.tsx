'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Settings, MapPin } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl border-b border-black/8 shadow-sm'
          : 'bg-white/70 backdrop-blur-md border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          {/* Apple-style logo mark */}
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
              {/* Apple icon SVG */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 814 1000"
                fill="white"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.6-163.7-117.1C155 398.8 mm0 243.4 0 157.2c0-111.1 72.4-170 142.4-170 53 0 97.2 33.2 130.3 33.2 31.8 0 81.5-35.7 143.7-35.7 22.4 0 108.7 2 163.7 101.3zm-153.3-122.8c21.6-26.1 37-62 37-97.9 0-5.1-.5-10.2-1.6-14.5-35.1 1.3-76.7 23.5-101.1 53.1-19.4 22.9-37 58.9-37 95.2 0 5.9 1 11.8 1.6 13.7 2.3.4 6.1 1 9.9 1 31.6 0 68.2-21.1 91.2-50.6z" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[17px] font-extrabold tracking-tight text-gray-950">
              iPlanet
            </span>
            <span className="text-[11px] font-semibold text-blue-600 tracking-wider uppercase">
              AI Store Locator
            </span>
          </div>
        </Link>

        {/* Center: Tagline (desktop only) */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>Official Apple Authorised Reseller · Store Finder</span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-full border border-emerald-200/80 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Database Verified</span>
            <span className="inline md:hidden">Verified</span>
          </div>

          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 rounded-xl border border-gray-200/80 hover:border-blue-200 transition-all duration-150"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </div>
      </div>
    </header>
  );
};
