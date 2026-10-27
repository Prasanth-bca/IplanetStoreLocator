'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LogOut, MapPin, Package, Settings, Tag, type LucideIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Destination {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  tint: string;
}

const FINDER: Destination = {
  href: '/locator',
  title: 'Store Finder',
  description: 'Find the nearest iPlanet store or Care centre by PIN code, area, landmark or your current location, with distance, travel time and directions.',
  Icon: MapPin,
  tint: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
};

const TOOLS: Destination[] = [
  {
    href: '/admin/stock',
    title: 'Stock',
    description: 'See what each store has in stock and update quantities, one store at a time or in bulk.',
    Icon: Package,
    tint: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
  },
  {
    href: '/admin/products',
    title: 'Products',
    description: 'Add products, edit their details, and enable or disable them across all stores.',
    Icon: Tag,
    tint: 'bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400',
  },
  {
    href: '/admin',
    title: 'Admin',
    description: 'Manage the store master list: add or remove stores, change status and bulk import.',
    Icon: Settings,
    tint: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
  },
];

function DestinationCard({ d, large = false }: { d: Destination; large?: boolean }) {
  return (
    <Link
      href={d.href}
      className="group relative flex flex-col rounded-3xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#16161a] p-6 transition hover:-translate-y-0.5 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{ textDecoration: 'none' }}
    >
      <div className={`${large ? 'w-14 h-14' : 'w-12 h-12'} rounded-2xl flex items-center justify-center ${d.tint}`}>
        <d.Icon className={large ? 'w-7 h-7' : 'w-6 h-6'} />
      </div>
      <h3 className={`${large ? 'text-2xl' : 'text-lg'} mt-5 font-extrabold tracking-tight text-gray-950 dark:text-white`}>{d.title}</h3>
      <p className={`mt-1.5 text-gray-500 dark:text-gray-400 leading-relaxed ${large ? 'text-[15px] max-w-xl' : 'text-sm'}`}>{d.description}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400">
        Open <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0a0a0c] text-gray-900 dark:text-gray-100">
      <header className="border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-[#0e0e11]/70 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex flex-col leading-none">
            <span className="text-[17px] font-extrabold tracking-tight text-gray-950 dark:text-white">iPlanet</span>
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase">AI Store Locator</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={logout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 bg-gray-100 dark:bg-zinc-800/90 hover:bg-red-50 dark:hover:bg-zinc-700 rounded-xl border border-gray-200/80 dark:border-zinc-700 transition disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-950 dark:text-white">Welcome to iPlanet</h1>
          <p className="mt-2 text-base text-gray-500 dark:text-gray-400">Choose where you want to go.</p>
        </div>

        <section aria-labelledby="customer-heading" className="mb-10">
          <h2 id="customer-heading" className="text-[11px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-3">
            For customers
          </h2>
          <DestinationCard d={FINDER} large />
        </section>

        <section aria-labelledby="tools-heading">
          <h2 id="tools-heading" className="text-[11px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400 mb-3">
            Management tools
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {TOOLS.map(t => (
              <DestinationCard key={t.href} d={t} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
