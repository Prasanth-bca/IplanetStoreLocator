import React from 'react';
import { Smartphone, Tablet, Laptop, Watch, Headphones, Plug, Package, type LucideIcon } from 'lucide-react';

export type Status = 'in_stock' | 'low' | 'out' | 'unknown';

export const STATUS_META: Record<Status, { label: string; pill: string; dot: string; text: string }> = {
  in_stock: {
    label: 'In stock',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  low: {
    label: 'Low stock',
    pill: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  out: {
    label: 'Out of stock',
    pill: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60',
    dot: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
  },
  unknown: {
    label: 'Call to confirm',
    pill: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:border-zinc-700',
    dot: 'bg-gray-400',
    text: 'text-gray-500 dark:text-gray-400',
  },
};

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${m.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {label ?? m.label}
    </span>
  );
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'Not updated yet';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Updated ${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
}

export function liveStatus(qty: number | null, threshold: number): Status {
  if (qty === null) return 'unknown';
  if (qty <= 0) return 'out';
  return qty <= threshold ? 'low' : 'in_stock';
}

/** Visual identity per product category, shared by the product and stock card grids. */

const CATEGORY_META: Record<string, { Icon: LucideIcon; tint: string }> = {
  iphone: { Icon: Smartphone, tint: 'from-sky-500/15 to-blue-500/5 text-sky-600 dark:text-sky-400' },
  ipad: { Icon: Tablet, tint: 'from-violet-500/15 to-purple-500/5 text-violet-600 dark:text-violet-400' },
  mac: { Icon: Laptop, tint: 'from-slate-500/15 to-gray-500/5 text-slate-600 dark:text-slate-300' },
  watch: { Icon: Watch, tint: 'from-rose-500/15 to-pink-500/5 text-rose-600 dark:text-rose-400' },
  airpods: { Icon: Headphones, tint: 'from-teal-500/15 to-emerald-500/5 text-teal-600 dark:text-teal-400' },
  accessories: { Icon: Plug, tint: 'from-amber-500/15 to-orange-500/5 text-amber-600 dark:text-amber-400' },
};

export function categoryMeta(category: string) {
  return CATEGORY_META[category.trim().toLowerCase()] ?? { Icon: Package, tint: 'from-blue-500/15 to-indigo-500/5 text-blue-600 dark:text-blue-400' };
}

export function CategoryIcon({ category, className = '' }: { category: string; className?: string }) {
  const { Icon, tint } = categoryMeta(category);
  return (
    <div className={`flex items-center justify-center rounded-2xl bg-gradient-to-br ${tint} ${className}`}>
      <Icon className="w-1/2 h-1/2" />
    </div>
  );
}
