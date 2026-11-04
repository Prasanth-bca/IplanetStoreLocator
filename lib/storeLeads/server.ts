/** Server-side helpers for store-wise leads: who a store login belongs to, creating reminders, and shaping what each audience may see. */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser, SessionUser } from '@/lib/auth';
import { istDayRange, istMonthRange, todayIST } from '@/lib/leads';
import { FIRST_REMINDER_MIN, isOverdueFollowUp, minutesWaiting, reminderDueAt, reminderLevel, statusOf, STATUS_LABEL } from './rules';

export const tableMissing = (e: unknown) => ['P2021', 'P2022'].includes((e as { code?: string })?.code ?? '');
export const MISSING_MSG = 'The store leads tables have not been created yet. Ask the admin to run prisma/manual/store_leads.sql.';

/* ───────────── which store a login belongs to ───────────── */

const accountCache = new Map<string, { at: number; posCode: string | null }>();
const ACCOUNT_TTL_MS = 30_000;
export const forgetStoreAccount = (userId: string) => accountCache.delete(userId);

export async function storeOfUser(userId: string): Promise<string | null> {
  const hit = accountCache.get(userId);
  if (hit && Date.now() - hit.at < ACCOUNT_TTL_MS) return hit.posCode;
  const row = await prisma.storeAccount.findUnique({ where: { userId }, select: { posCode: true } });
  accountCache.set(userId, { at: Date.now(), posCode: row?.posCode ?? null });
  return row?.posCode ?? null;
}

export type StoreGuard = { ok: true; user: SessionUser; isAdmin: boolean; posCode: string | null } | { ok: false; response: NextResponse };

/**
 * For the routes a store login uses. A STORE person gets their own store's POS code (never taken from the request);
 * an admin gets `null`, meaning "any store". A sales user is refused.
 */
export async function requireStoreAccess(request: NextRequest): Promise<StoreGuard> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  if (auth.user.role === 'ADMIN') return { ok: true, user: auth.user, isAdmin: true, posCode: null };
  if (auth.user.role !== 'STORE') return { ok: false, response: NextResponse.json({ error: 'You don’t have permission to do this.' }, { status: 403 }) };
  let posCode: string | null;
  try {
    posCode = await storeOfUser(auth.user.id);
  } catch (e) {
    if (tableMissing(e)) return { ok: false, response: NextResponse.json({ error: MISSING_MSG, tableMissing: true }, { status: 503 }) };
    throw e;
  }
  if (!posCode) return { ok: false, response: NextResponse.json({ error: 'This login is not linked to a store. Ask the admin.' }, { status: 403 }) };
  return { ok: true, user: auth.user, isAdmin: false, posCode };
}

/* ───────────── automatic reminders ───────────── */

let lastRun = 0;
let running: Promise<number> | null = null;

/**
 * Creates the 20- and 40-minute reminders that have fallen due. Safe to call as often as you like, from anywhere:
 * the reminders are worked out from each lead's assignment time (not from when this runs), and the unique key on
 * (lead, reminder) means a reminder is created exactly once. Without `force`, it runs at most every 15 seconds per server.
 * If another request is already creating them, this waits for that run instead of skipping, so a page that asks at the
 * same moment still sees them straight away.
 */
export async function ensureReminders(now = new Date(), force = false): Promise<number> {
  if (running) return running;
  if (!force && Date.now() - lastRun < 15_000) return 0;
  lastRun = Date.now();
  running = createDueReminders(now).finally(() => {
    running = null;
  });
  return running;
}

async function createDueReminders(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - FIRST_REMINDER_MIN * 60_000);
  const due = await prisma.storeLead.findMany({
    where: { firstResponseAt: null, conversion: null, assignedAt: { lte: cutoff } },
    select: { id: true, posCode: true, assignedAt: true, firstResponseAt: true, conversion: true },
    take: 1000,
  });
  if (due.length === 0) return 0;
  const have = await prisma.leadNotification.findMany({ where: { storeLeadId: { in: due.map((d) => d.id) } }, select: { storeLeadId: true, kind: true } });
  const haveSet = new Set(have.map((h) => `${h.storeLeadId}|${h.kind}`));
  const rows: Prisma.LeadNotificationCreateManyInput[] = [];
  for (const l of due) {
    const level = reminderLevel(l, now);
    for (const lv of [1, 2] as const) {
      const kind = lv === 1 ? 'REMINDER_20' : 'REMINDER_40';
      if (level >= lv && !haveSet.has(`${l.id}|${kind}`)) rows.push({ storeLeadId: l.id, posCode: l.posCode, kind, dueAt: reminderDueAt(l.assignedAt, lv) });
    }
  }
  if (rows.length === 0) return 0;
  const r = await prisma.leadNotification.createMany({ data: rows, skipDuplicates: true });
  return r.count;
}

/* ───────────── what each audience sees ───────────── */

type Row = Prisma.StoreLeadGetPayload<{ include: { activities: { orderBy: { at: 'desc' }; take: 1 } } }>;
export type Audience = 'store' | 'sales' | 'admin';

export function serializeLead(l: Row, now: Date, audience: Audience) {
  const level = reminderLevel(l, now);
  const last = l.activities.find((a) => a.note);
  return {
    id: l.id,
    customerName: l.customerName,
    customerMobile: l.customerMobile,
    requirement: l.requirement,
    remarks: l.remarks,
    assignedAt: l.assignedAt.toISOString(),
    interest: l.interest,
    visitIntention: l.visitIntention,
    conversion: l.conversion,
    status: statusOf(l),
    statusLabel: STATUS_LABEL[statusOf(l)],
    firstResponseAt: l.firstResponseAt?.toISOString() ?? null,
    lastActivityAt: l.lastActivityAt.toISOString(),
    closedAt: l.closedAt?.toISOString() ?? null,
    lastRemark: last?.note ?? null,
    reminderLevel: level,
    minutesWaiting: !l.firstResponseAt && !l.conversion ? minutesWaiting(l.assignedAt, now) : null,
    overdueFollowUp: isOverdueFollowUp(l, now),
    ...(audience === 'store' ? {} : { posCode: l.posCode, storeName: l.storeName }),
    // The store never sees who shared the lead; the sales user sees only their own, so it is theirs by definition.
    ...(audience === 'store' ? {} : { sharedByName: l.sharedByName }),
    // Billed customer details: the store that entered them and the admin. Not the sales user.
    ...(audience === 'sales' ? {} : { billedName: l.billedName, billedMobile: l.billedMobile }),
  };
}

export const withLast = { activities: { orderBy: { at: 'desc' as const }, take: 1 } };

/* ───────────── date range ───────────── */

export function rangeFrom(sp: URLSearchParams): { start: Date; end: Date; label: { type: 'day' | 'month'; value: string } } | null {
  const month = sp.get('month');
  const date = sp.get('date') ?? (month ? null : null);
  if (month) {
    const r = istMonthRange(month);
    return r ? { ...r, label: { type: 'month', value: month } } : null;
  }
  const day = date ?? todayIST();
  if (sp.get('all') === '1') return { start: new Date(0), end: new Date(8.64e15), label: { type: 'month', value: 'all' } };
  const r = istDayRange(day);
  return r ? { ...r, label: { type: 'day', value: day } } : null;
}

export const MAX_ROWS = 3000;
