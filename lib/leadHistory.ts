/** Lead history query shared by the Admin view (everyone's leads) and "My leads" (one person's). */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { istDateKey, istDayRange, istMonthRange, todayIST } from '@/lib/leads';

/** Hard cap so a very busy month can't return an unbounded payload. */
const MAX_LEADS = 5000;

/**
 * Lead history for one day (?date=YYYY-MM-DD) or one month (?month=YYYY-MM), in India time.
 * Defaults to today. `onlyUserId` limits it to one person's leads; it must come from the session,
 * never from the request.
 */
export async function leadHistoryResponse(request: NextRequest, onlyUserId?: string): Promise<NextResponse> {
  const params = new URL(request.url).searchParams;
  const month = params.get('month');
  const date = params.get('date') ?? (month ? null : todayIST());

  const range = month ? istMonthRange(month) : istDayRange(date ?? '');
  if (!range) {
    return NextResponse.json({ error: 'Use date=YYYY-MM-DD or month=YYYY-MM' }, { status: 400 });
  }
  const posCode = onlyUserId ? undefined : params.get('posCode')?.trim();

  try {
    const rows = await prisma.lead.findMany({
      where: {
        createdAt: { gte: range.start, lt: range.end },
        ...(onlyUserId ? { userId: onlyUserId } : {}),
        ...(posCode ? { posCode: { equals: posCode, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_LEADS + 1,
    });
    const truncated = rows.length > MAX_LEADS;
    const leads = truncated ? rows.slice(0, MAX_LEADS) : rows;

    const byDay = new Map<string, number>();
    const byStore = new Map<string, { posCode: string; storeName: string; count: number }>();
    const byProduct = new Map<string, number>();
    for (const l of leads) {
      const day = istDateKey(l.createdAt);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      const s = byStore.get(l.posCode) ?? { posCode: l.posCode, storeName: l.storeName, count: 0 };
      s.count++;
      byStore.set(l.posCode, s);
      byProduct.set(l.product, (byProduct.get(l.product) ?? 0) + 1);
    }

    return NextResponse.json({
      range: month ? { type: 'month', value: month } : { type: 'day', value: date },
      total: leads.length,
      truncated,
      leads: leads.map(l => ({
        id: l.id,
        createdAt: l.createdAt.toISOString(),
        customerName: l.customerName,
        customerMobile: l.customerMobile,
        storeName: l.storeName,
        posCode: l.posCode,
        product: l.product,
        remarks: l.remarks,
        channel: l.channel,
        passedBy: l.userName,
      })),
      byDay: Array.from(byDay, ([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day)),
      byStore: Array.from(byStore.values()).sort((a, b) => b.count - a.count),
      byProduct: Array.from(byProduct, ([product, count]) => ({ product, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    });
  } catch (error) {
    console.error('Lead history error:', error);
    return NextResponse.json({ error: 'Failed to load lead history' }, { status: 500 });
  }
}
