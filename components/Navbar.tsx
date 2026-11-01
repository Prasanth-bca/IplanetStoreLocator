'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, LogOut, Home, Calculator, ExternalLink } from 'lucide-react';
import { CalculatorModal } from '@/components/CalculatorModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BrandMark } from '@/components/BrandMark';
import { resetCurrentUser, useCurrentUser } from '@/lib/useCurrentUser';

const QUICK_LINKS = [
  { label: 'iPlanet.One', href: 'https://iplanet.one/' },
  { label: 'Apple.In', href: 'https://www.apple.com/in/?cid-oas-in-domains-apple.in/' },
  { label: 'CRM', href: 'https://carecrm.iplanet.one/#/authentication/signin' },
  { label: 'GSX', href: 'https://idmsa.apple.com/IDMSWebAuth/signin?appIdKey=56d0803270308d5042fac8647e21e41e5028903d62a009366450bb6b52a32bf3&rv=1&relayState=Lw==&language=GB-EN-' },
];

const BAR_BTN =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-zinc-800/90 hover:bg-blue-50 dark:hover:bg-zinc-700 rounded-xl border border-gray-200/80 dark:border-zinc-700 hover:border-blue-200 transition-all duration-150 whitespace-nowrap';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const { user } = useCurrentUser();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await fetch('/api/logout', { method: 'POST' });
    resetCurrentUser();
    router.push('/login');
    router.refresh();
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 dark:bg-pal-bar-dark/90 backdrop-blur-xl border-b border-black/8 dark:border-white/10 shadow-sm'
          : 'bg-white/70 dark:bg-pal-bar-dark/70 backdrop-blur-md border-b border-transparent'
      }`}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 2xl:px-12 min-h-16 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Brand */}
        <Link href="/locator" className="flex items-center gap-3 group shrink-0">
          {/* logo mark: a half-cut apple */}
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pal-bar-dark to-pal-brand-dark flex items-center justify-center shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
              <BrandMark size={36} className="rounded-xl" />
            </div>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[17px] font-extrabold tracking-tight text-gray-950 dark:text-white">
              iPlanet
            </span>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase">
              CEC Connect
            </span>
            <span className="mt-1 text-[10px] font-medium leading-tight text-gray-500 dark:text-gray-400">One click, everything connected</span>
          </div>
        </Link>

        {/* Left: quick links to the other tools, each opens in a new tab. Own row on small screens. */}
        <nav aria-label="Quick links" className="order-last lg:order-none flex w-full lg:w-auto lg:flex-1 items-center gap-2 overflow-x-auto lg:overflow-visible">
          {QUICK_LINKS.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={BAR_BTN}>
              {l.label}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          ))}
        </nav>

        {/* Right: calculator, links, one aligned group */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setCalcOpen(true)} className={BAR_BTN} aria-haspopup="dialog" aria-label="Calculator" title="Calculator">
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Calculator</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-zinc-800/90 hover:bg-blue-50 dark:hover:bg-zinc-700 rounded-xl border border-gray-200/80 dark:border-zinc-700 hover:border-blue-200 transition-all duration-150"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>

          {user?.role === 'ADMIN' && (
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-zinc-800/90 hover:bg-blue-50 dark:hover:bg-zinc-700 rounded-xl border border-gray-200/80 dark:border-zinc-700 hover:border-blue-200 transition-all duration-150"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 bg-gray-100 dark:bg-zinc-800/90 hover:bg-red-50 dark:hover:bg-zinc-700 rounded-xl border border-gray-200/80 dark:border-zinc-700 hover:border-red-200 transition-all duration-150 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>

          <ThemeToggle />
        </div>
      </div>
      {calcOpen && <CalculatorModal onClose={() => setCalcOpen(false)} />}
    </header>
  );
};
