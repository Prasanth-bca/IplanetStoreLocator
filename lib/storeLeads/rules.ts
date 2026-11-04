/**
 * Store-wise lead rules: what a shared lead must contain, what a store may change, when a reminder is due,
 * and how the report numbers are counted. Pure (no database, no clock of its own), so it is easy to test.
 * India dates are used for "today" and "tomorrow".
 */

import { normalizeMobile } from '../enquiry';
import { istDayRange } from '../leads';

export const INTERESTS = ['COLD', 'WARM', 'HOT'] as const;
export const VISITS = ['TODAY', 'TOMORROW', 'LATER'] as const;
export const CONVERSIONS = ['CLOSED', 'NOT_CLOSED', 'NOT_INTERESTED'] as const;
export type Interest = (typeof INTERESTS)[number];
export type Visit = (typeof VISITS)[number];
export type Conversion = (typeof CONVERSIONS)[number];

export const INTEREST_LABEL: Record<Interest, string> = { COLD: 'Cold', WARM: 'Warm', HOT: 'Hot' };
export const VISIT_LABEL: Record<Visit, string> = { TODAY: 'CX will visit today', TOMORROW: 'CX will visit tomorrow', LATER: 'CX will decide and visit later' };
export const CONVERSION_LABEL: Record<Conversion, string> = { CLOSED: 'Closed', NOT_CLOSED: 'Not Closed', NOT_INTERESTED: 'Not Interested' };

/** Minutes after assignment when the first and second reminders fall due. */
export const FIRST_REMINDER_MIN = 20;
export const SECOND_REMINDER_MIN = 40;
/** A follow-up with no expected visit date is overdue after this many days without an update. */
export const IDLE_FOLLOW_UP_DAYS = 3;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const text = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined => list.find((x) => x === text(v).toUpperCase().replace(/\s+/g, '_'));

/* ───────────── store logins ───────────── */

/** The username a store login gets: "store." plus its POS code in lower case without spaces or symbols (PBZ1 → store.pbz1, "IND 1" → store.ind1). */
export const usernameForStore = (posCode: string): string => `store.${posCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

/* ───────────── sharing a lead ───────────── */

export interface ShareInput {
  clientId: string;
  customerName: string;
  customerMobile: string;
  requirement: string;
  remarks: string | null;
  posCode: string;
}
export type Checked<T> = { ok: true; data: T } | { ok: false; errors: string[] };

const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;

export function checkShare(raw: Record<string, unknown>): Checked<ShareInput> {
  const errors: string[] = [];
  const clientId = String(raw.clientId ?? '');
  if (!CLIENT_ID.test(clientId)) errors.push('The form is out of date. Please refresh the page and try again.');

  const customerName = text(raw.customerName);
  if (customerName.length < 2) errors.push('Enter the customer’s name.');
  else if (customerName.length > 80) errors.push('Customer name is too long (limit 80 characters).');

  const mobile = normalizeMobile(String(raw.customerMobile ?? ''));
  if (!mobile) errors.push(text(raw.customerMobile) ? 'Customer contact number must be a 10-digit mobile number (starting 6 to 9).' : 'Enter the customer’s contact number.');

  const requirement = text(raw.requirement);
  if (!requirement) errors.push('Enter what the customer needs, for example “iPhone 17 Pro 256GB”.');
  else if (requirement.length > 120) errors.push('Customer requirement is too long (limit 120 characters).');

  const remarks = String(raw.remarks ?? '').trim();
  if (remarks.length > 500) errors.push('Remarks are too long (limit 500 characters).');

  const posCode = text(raw.posCode);
  if (!posCode) errors.push('Select the store that should receive this lead.');

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { clientId, customerName, customerMobile: mobile as string, requirement, remarks: remarks || null, posCode } };
}

/* ───────────── a store updating a lead ───────────── */

export interface LeadState {
  interest: string | null;
  visitIntention: string | null;
  conversion: string | null;
  billedName: string | null;
  billedMobile: string | null;
  firstResponseAt: Date | null;
}

export interface LeadUpdate {
  interest?: Interest;
  visitIntention?: Visit;
  conversion?: Conversion;
  billedName?: string | null;
  billedMobile?: string | null;
  /** A follow-up remark to add to the history. */
  remark?: string;
}

export interface UpdateResult {
  /** New values for the columns that change. */
  set: { interest?: Interest; visitIntention?: Visit; conversion?: Conversion; billedName?: string | null; billedMobile?: string | null };
  remark: string | null;
  /** True when this counts as the store's response (stops the reminders). */
  isResponse: boolean;
  /** True when the lead becomes Closed with this update, which is when the celebration shows. */
  becomesClosed: boolean;
}

/** A remark must say something: three real characters stops a single "." from silencing the reminders. */
export const REMARK_MIN = 3;
export const REMARK_MAX = 500;

/**
 * Checks a store's update. `isAdmin` lets an admin correct a closed lead; a store cannot change a lead
 * once it is Closed (it can still add remarks).
 */
export function checkUpdate(current: LeadState, raw: Record<string, unknown>, isAdmin = false): Checked<UpdateResult> {
  const errors: string[] = [];
  const set: UpdateResult['set'] = {};

  if (raw.interest !== undefined && raw.interest !== null && raw.interest !== '') {
    const v = oneOf(INTERESTS, raw.interest);
    if (!v) errors.push('Interest level must be Cold, Warm or Hot.');
    else if (v !== current.interest) set.interest = v;
  }
  if (raw.visitIntention !== undefined && raw.visitIntention !== null && raw.visitIntention !== '') {
    const v = oneOf(VISITS, raw.visitIntention);
    if (!v) errors.push('Visit intention must be today, tomorrow or later.');
    else if (v !== current.visitIntention) set.visitIntention = v;
  }

  let remark: string | null = null;
  if (raw.remark !== undefined && raw.remark !== null) {
    const r = String(raw.remark).replace(/\r/g, '').trim();
    if (r) {
      if (r.replace(/\s/g, '').length < REMARK_MIN) errors.push(`Write a few words in the follow-up remark (at least ${REMARK_MIN} characters).`);
      else if (r.length > REMARK_MAX) errors.push(`The follow-up remark is too long (limit ${REMARK_MAX} characters).`);
      else remark = r;
    }
  }

  const locked = current.conversion === 'CLOSED' && !isAdmin;
  let becomesClosed = false;
  let conversionTouched = false;

  if (raw.conversion !== undefined && raw.conversion !== null && raw.conversion !== '') {
    const v = oneOf(CONVERSIONS, raw.conversion);
    if (!v) errors.push('Conversion status must be Closed, Not Closed or Not Interested.');
    else if (v !== current.conversion) {
      conversionTouched = true;
      if (locked) errors.push('This lead is already Closed and can’t be changed. Ask an admin if it was closed by mistake.');
      else {
        set.conversion = v;
        becomesClosed = v === 'CLOSED';
      }
    }
  }

  // Billing details are required for Closed and are kept only while the lead is Closed.
  const finalConversion = set.conversion ?? current.conversion;
  const billedTouched = raw.billedName !== undefined || raw.billedMobile !== undefined;
  if (finalConversion === 'CLOSED') {
    const name = raw.billedName !== undefined ? text(raw.billedName) : text(current.billedName);
    const mobileRaw = raw.billedMobile !== undefined ? String(raw.billedMobile ?? '') : String(current.billedMobile ?? '');
    const mobile = normalizeMobile(mobileRaw);
    if (name.length < 2) errors.push('Enter the billed customer’s name to close this lead.');
    else if (name.length > 80) errors.push('Billed customer name is too long (limit 80 characters).');
    if (!mobile) errors.push(text(mobileRaw) ? 'Billed mobile number must be a 10-digit mobile number (starting 6 to 9).' : 'Enter the billed mobile number to close this lead.');
    if (billedTouched && locked && !conversionTouched) errors.push('This lead is already Closed. The billing details can’t be changed. Ask an admin to correct them.');
    if (!errors.length) {
      if (name !== text(current.billedName)) set.billedName = name;
      if (mobile && mobile !== current.billedMobile) set.billedMobile = mobile;
    }
  } else if (set.conversion && current.billedName) {
    set.billedName = null;
    set.billedMobile = null;
  }

  const hasChange = Object.keys(set).length > 0 || remark !== null;
  if (!errors.length && !hasChange) errors.push('Nothing to update. Change a status or write a follow-up remark.');
  if (errors.length) return { ok: false, errors };

  const isResponse = set.interest !== undefined || set.visitIntention !== undefined || set.conversion !== undefined || remark !== null;
  return { ok: true, data: { set, remark, isResponse, becomesClosed } };
}

/* ───────────── reminders and status ───────────── */

export interface TimedLead {
  assignedAt: Date;
  firstResponseAt: Date | null;
  conversion: string | null;
}

/** 0 = nothing due, 1 = the 20-minute reminder is due, 2 = the 40-minute reminder is due. Counted from the assignment time. */
export function reminderLevel(lead: TimedLead, now: Date): 0 | 1 | 2 {
  if (lead.firstResponseAt || lead.conversion) return 0;
  const waited = now.getTime() - lead.assignedAt.getTime();
  if (waited >= SECOND_REMINDER_MIN * MINUTE) return 2;
  if (waited >= FIRST_REMINDER_MIN * MINUTE) return 1;
  return 0;
}

export const minutesWaiting = (assignedAt: Date, now: Date): number => Math.max(0, Math.floor((now.getTime() - assignedAt.getTime()) / MINUTE));

/** The moment a reminder falls due: assignment plus 20 or 40 minutes. */
export const reminderDueAt = (assignedAt: Date, level: 1 | 2): Date => new Date(assignedAt.getTime() + (level === 1 ? FIRST_REMINDER_MIN : SECOND_REMINDER_MIN) * MINUTE);

export type StatusKey = 'NEW' | 'FOLLOW_UP' | 'CLOSED' | 'NOT_CLOSED' | 'NOT_INTERESTED';
export const STATUS_LABEL: Record<StatusKey, string> = { NEW: 'New, awaiting response', FOLLOW_UP: 'In follow-up', CLOSED: 'Closed', NOT_CLOSED: 'Not Closed', NOT_INTERESTED: 'Not Interested' };

/** The "current lead status" shown in the table. */
export function statusOf(lead: { conversion: string | null; firstResponseAt: Date | null }): StatusKey {
  if (lead.conversion === 'CLOSED' || lead.conversion === 'NOT_CLOSED' || lead.conversion === 'NOT_INTERESTED') return lead.conversion;
  return lead.firstResponseAt ? 'FOLLOW_UP' : 'NEW';
}

export interface FollowUpLead extends TimedLead {
  visitIntention: string | null;
  visitUpdatedAt: Date | null;
  lastActivityAt: Date;
}

/**
 * An open lead (the store has responded, but it is not Closed or Not Interested) is overdue once its expected visit
 * day has passed without a newer update. "Today" and "tomorrow" count from the day the store set them; with no
 * expected day, a lead is overdue after IDLE_FOLLOW_UP_DAYS days of silence.
 */
export function isOverdueFollowUp(lead: FollowUpLead, now: Date): boolean {
  if (!lead.firstResponseAt) return false; // awaiting a first response is a different alert
  if (lead.conversion === 'CLOSED' || lead.conversion === 'NOT_INTERESTED') return false;
  let base: number | null = null;
  if ((lead.visitIntention === 'TODAY' || lead.visitIntention === 'TOMORROW') && lead.visitUpdatedAt) {
    const day = istDayRange(new Date(lead.visitUpdatedAt.getTime() + 5.5 * 60 * MINUTE).toISOString().slice(0, 10));
    if (day) base = day.end.getTime() + (lead.visitIntention === 'TOMORROW' ? DAY : 0) - 1;
  }
  let due: number;
  if (base !== null && lead.lastActivityAt.getTime() <= base) due = base;
  else due = lead.lastActivityAt.getTime() + IDLE_FOLLOW_UP_DAYS * DAY;
  return now.getTime() > due;
}

/* ───────────── report numbers ───────────── */

export interface ReportLead extends FollowUpLead {
  interest: string | null;
}

export interface Summary {
  total: number;
  cold: number;
  warm: number;
  hot: number;
  visitToday: number;
  visitTomorrow: number;
  visitLater: number;
  closed: number;
  notClosed: number;
  notInterested: number;
  /** No conversion status yet. */
  undecided: number;
  /** Awaiting the store's first response. */
  pendingFirstResponse: number;
  pendingOver20: number;
  pendingOver40: number;
  overdueFollowUps: number;
  /** Closed as a share of all leads received, 0 to 100, one decimal. */
  conversionPercent: number;
}

export function summarise(leads: ReportLead[], now: Date): Summary {
  const s: Summary = { total: leads.length, cold: 0, warm: 0, hot: 0, visitToday: 0, visitTomorrow: 0, visitLater: 0, closed: 0, notClosed: 0, notInterested: 0, undecided: 0, pendingFirstResponse: 0, pendingOver20: 0, pendingOver40: 0, overdueFollowUps: 0, conversionPercent: 0 };
  for (const l of leads) {
    if (l.interest === 'COLD') s.cold++;
    else if (l.interest === 'WARM') s.warm++;
    else if (l.interest === 'HOT') s.hot++;
    // expected visits are only counted for leads still being worked
    if (l.conversion !== 'CLOSED' && l.conversion !== 'NOT_INTERESTED') {
      if (l.visitIntention === 'TODAY') s.visitToday++;
      else if (l.visitIntention === 'TOMORROW') s.visitTomorrow++;
      else if (l.visitIntention === 'LATER') s.visitLater++;
    }
    if (l.conversion === 'CLOSED') s.closed++;
    else if (l.conversion === 'NOT_CLOSED') s.notClosed++;
    else if (l.conversion === 'NOT_INTERESTED') s.notInterested++;
    else s.undecided++;
    if (!l.firstResponseAt && !l.conversion) {
      s.pendingFirstResponse++;
      const lvl = reminderLevel(l, now);
      if (lvl >= 1) s.pendingOver20++;
      if (lvl >= 2) s.pendingOver40++;
    }
    if (isOverdueFollowUp(l, now)) s.overdueFollowUps++;
  }
  s.conversionPercent = s.total ? Math.round((s.closed / s.total) * 1000) / 10 : 0;
  return s;
}

/** Splits leads by a key (store, sales person) and summarises each group, largest first. */
export function summariseBy<T extends ReportLead>(leads: T[], key: (l: T) => string, label: (l: T) => string, now: Date): { key: string; label: string; summary: Summary }[] {
  const groups = new Map<string, { label: string; rows: T[] }>();
  for (const l of leads) {
    const k = key(l);
    const g = groups.get(k) ?? { label: label(l), rows: [] };
    g.rows.push(l);
    groups.set(k, g);
  }
  return Array.from(groups.entries())
    .map(([k, g]) => ({ key: k, label: g.label, summary: summarise(g.rows, now) }))
    .sort((a, b) => b.summary.total - a.summary.total || a.label.localeCompare(b.label));
}
