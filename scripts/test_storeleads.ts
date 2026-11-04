/** Checks for the store-wise lead rules. Run with: npm run test:storeleads */
import assert from 'node:assert/strict';
import { canAccess, isRole, ASSIGNABLE_ROLES } from '../lib/access';
import { parseRole } from '../lib/userRules';
import {
  checkShare, checkUpdate, reminderLevel, reminderDueAt, minutesWaiting, statusOf, isOverdueFollowUp, summarise, summariseBy,
  FIRST_REMINDER_MIN, SECOND_REMINDER_MIN, usernameForStore, type LeadState, type ReportLead,
} from '../lib/storeLeads/rules';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log('ok   -', name); } catch (e) { process.exitCode = 1; console.log('FAIL -', name, '\n      ', (e as Error).message.split('\n').slice(0, 3).join('\n       ')); }
}
const T0 = new Date('2026-11-04T05:00:00.000Z'); // 10:30 am India
const plus = (min: number) => new Date(T0.getTime() + min * 60_000);

/* ── sharing ── */
const share = { clientId: 'abcd1234-ef56', customerName: 'Nikitha R', customerMobile: '99866 64876', requirement: 'iPhone 17 Pro 256GB', remarks: 'Wants a callback', posCode: 'TAM' };
const badShare = (o: Record<string, unknown>, re: RegExp) => { const r = checkShare({ ...share, ...o }); assert.ok(!r.ok); if (!r.ok) assert.ok(r.errors.some((e) => re.test(e)), r.errors.join('|')); };

test('a complete share is accepted and tidied (mobile to 10 digits, spaces collapsed)', () => {
  const r = checkShare({ ...share, customerName: '  Nikitha   R ', customerMobile: '+91 99866-64876' });
  assert.ok(r.ok); if (r.ok) { assert.equal(r.data.customerName, 'Nikitha R'); assert.equal(r.data.customerMobile, '9986664876'); assert.equal(r.data.remarks, 'Wants a callback'); }
});
test('remarks are optional', () => { const r = checkShare({ ...share, remarks: '' }); assert.ok(r.ok); if (r.ok) assert.equal(r.data.remarks, null); });
test('name, number, requirement and store are required; bad numbers are refused', () => {
  badShare({ customerName: '' }, /customer’s name/); badShare({ customerName: 'A' }, /customer’s name/);
  badShare({ customerMobile: '' }, /contact number/); badShare({ customerMobile: '12345' }, /10-digit/); badShare({ customerMobile: '5123456789' }, /10-digit/);
  badShare({ requirement: ' ' }, /needs/); badShare({ posCode: '' }, /Select the store/);
});
test('over-long text and a bad form id are refused', () => {
  badShare({ remarks: 'x'.repeat(501) }, /500/); badShare({ requirement: 'x'.repeat(121) }, /120/); badShare({ customerName: 'n'.repeat(81) }, /80/); badShare({ clientId: 'short' }, /out of date/);
});

/* ── reminders ── */
const fresh = { assignedAt: T0, firstResponseAt: null, conversion: null };
test('reminders are counted from the ASSIGNMENT time: nothing at 19:59, first at exactly 20:00, second at exactly 40:00', () => {
  assert.equal(reminderLevel(fresh, plus(0)), 0);
  assert.equal(reminderLevel(fresh, new Date(plus(FIRST_REMINDER_MIN).getTime() - 1000)), 0);
  assert.equal(reminderLevel(fresh, plus(FIRST_REMINDER_MIN)), 1);
  assert.equal(reminderLevel(fresh, new Date(plus(SECOND_REMINDER_MIN).getTime() - 1000)), 1);
  assert.equal(reminderLevel(fresh, plus(SECOND_REMINDER_MIN)), 2);
  assert.equal(reminderLevel(fresh, plus(600)), 2);
});
test('a response (or a decision) stops the reminders at any stage', () => {
  for (const m of [5, 25, 45, 500]) {
    assert.equal(reminderLevel({ ...fresh, firstResponseAt: plus(3) }, plus(m)), 0);
    assert.equal(reminderLevel({ ...fresh, conversion: 'NOT_INTERESTED' }, plus(m)), 0);
  }
});
test('the due time of each reminder is assignment + 20 / 40 minutes, whenever the server happens to notice', () => {
  assert.equal(reminderDueAt(T0, 1).getTime(), plus(20).getTime()); assert.equal(reminderDueAt(T0, 2).getTime(), plus(40).getTime());
});
test('minutes waiting never goes negative (clock skew) and floors to whole minutes', () => {
  assert.equal(minutesWaiting(T0, plus(-3)), 0); assert.equal(minutesWaiting(T0, new Date(plus(24).getTime() + 59_000)), 24);
});

/* ── updates ── */
const open: LeadState = { interest: null, visitIntention: null, conversion: null, billedName: null, billedMobile: null, firstResponseAt: null };
const upd = (cur: Partial<LeadState>, raw: Record<string, unknown>, admin = false) => checkUpdate({ ...open, ...cur }, raw, admin);
const badUpd = (cur: Partial<LeadState>, raw: Record<string, unknown>, re: RegExp, admin = false) => { const r = upd(cur, raw, admin); assert.ok(!r.ok, 'should be refused'); if (!r.ok) assert.ok(r.errors.some((e) => re.test(e)), r.errors.join('|')); };

test('each of the three choices on its own counts as a response', () => {
  for (const raw of [{ interest: 'hot' }, { visitIntention: 'TOMORROW' }, { conversion: 'not closed' }]) { const r = upd({}, raw); assert.ok(r.ok, JSON.stringify(raw)); if (r.ok) assert.equal(r.data.isResponse, true); }
});
test('a follow-up remark alone counts as a response; whitespace or a single dot does not', () => {
  const r = upd({}, { remark: 'Customer will call back tomorrow' }); assert.ok(r.ok); if (r.ok) { assert.equal(r.data.isResponse, true); assert.equal(r.data.remark, 'Customer will call back tomorrow'); }
  badUpd({}, { remark: '   ' }, /Nothing to update/); badUpd({}, { remark: '.' }, /few words/); badUpd({}, { remark: 'ok' }, /few words/);
});
test('unknown choices are refused with plain words', () => {
  badUpd({}, { interest: 'lukewarm' }, /Cold, Warm or Hot/); badUpd({}, { visitIntention: 'never' }, /today, tomorrow or later/); badUpd({}, { conversion: 'won' }, /Closed, Not Closed or Not Interested/);
});
test('setting the same value again, with nothing else, is "nothing to update"', () => { badUpd({ interest: 'HOT' }, { interest: 'HOT' }, /Nothing to update/); });
test('Closed REQUIRES the billed name and the billed mobile; the lead is not closed without them', () => {
  badUpd({}, { conversion: 'CLOSED' }, /billed customer’s name/); badUpd({}, { conversion: 'CLOSED', billedName: 'Ravi' }, /billed mobile number/);
  badUpd({}, { conversion: 'CLOSED', billedName: 'Ravi', billedMobile: '12345' }, /10-digit/); badUpd({}, { conversion: 'CLOSED', billedName: 'R', billedMobile: '9986664876' }, /billed customer’s name/);
  const r = upd({}, { conversion: 'CLOSED', billedName: ' Ravi  Kumar ', billedMobile: '+91 99866 64876' });
  assert.ok(r.ok); if (r.ok) { assert.equal(r.data.becomesClosed, true); assert.equal(r.data.set.billedName, 'Ravi Kumar'); assert.equal(r.data.set.billedMobile, '9986664876'); assert.equal(r.data.isResponse, true); }
});
test('billing details already on the lead are enough when it is closed later', () => {
  const r = upd({ billedName: 'Ravi', billedMobile: '9986664876' }, { conversion: 'CLOSED' }); assert.ok(r.ok);
});
test('a store cannot change a Closed lead (status or billing details) but can still add a remark; an admin can correct it', () => {
  const closed = { conversion: 'CLOSED', billedName: 'Ravi', billedMobile: '9986664876', firstResponseAt: T0 };
  badUpd(closed, { conversion: 'NOT_CLOSED' }, /already Closed/); badUpd(closed, { billedMobile: '9000000001' }, /already Closed/);
  const r = upd(closed, { remark: 'Delivered, customer happy' }); assert.ok(r.ok); if (r.ok) { assert.equal(r.data.becomesClosed, false); assert.deepEqual(r.data.set, {}); }
  const a = upd(closed, { conversion: 'NOT_CLOSED' }, true); assert.ok(a.ok); if (a.ok) { assert.equal(a.data.set.conversion, 'NOT_CLOSED'); assert.equal(a.data.set.billedName, null); assert.equal(a.data.set.billedMobile, null); }
});
test('the celebration flag is only true on the update that closes it, not on later remarks', () => {
  const first = upd({}, { conversion: 'CLOSED', billedName: 'Ravi', billedMobile: '9986664876' }); assert.ok(first.ok); if (first.ok) assert.equal(first.data.becomesClosed, true);
  const later = upd({ conversion: 'CLOSED', billedName: 'Ravi', billedMobile: '9986664876' }, { remark: 'Follow-up call done' }); assert.ok(later.ok); if (later.ok) assert.equal(later.data.becomesClosed, false);
});

/* ── status ── */
test('the displayed status follows the decision, else response, else "new"', () => {
  assert.equal(statusOf({ conversion: null, firstResponseAt: null }), 'NEW'); assert.equal(statusOf({ conversion: null, firstResponseAt: T0 }), 'FOLLOW_UP');
  assert.equal(statusOf({ conversion: 'CLOSED', firstResponseAt: T0 }), 'CLOSED'); assert.equal(statusOf({ conversion: 'NOT_INTERESTED', firstResponseAt: T0 }), 'NOT_INTERESTED'); assert.equal(statusOf({ conversion: 'NOT_CLOSED', firstResponseAt: T0 }), 'NOT_CLOSED');
});

/* ── overdue follow-ups ── */
// 4 Nov 2026 10:30 IST. End of that India day = 4 Nov 18:29:59.999 UTC.
const fu = (o: Partial<ReportLead>): ReportLead => ({ assignedAt: T0, firstResponseAt: T0, conversion: null, visitIntention: null, visitUpdatedAt: null, lastActivityAt: T0, interest: null, ...o });
test('"visit today" is overdue only after the India day ends', () => {
  const l = fu({ visitIntention: 'TODAY', visitUpdatedAt: T0, lastActivityAt: T0 });
  assert.equal(isOverdueFollowUp(l, new Date('2026-11-04T18:29:00.000Z')), false);
  assert.equal(isOverdueFollowUp(l, new Date('2026-11-04T18:31:00.000Z')), true);
});
test('"visit tomorrow" is overdue only after tomorrow ends', () => {
  const l = fu({ visitIntention: 'TOMORROW', visitUpdatedAt: T0, lastActivityAt: T0 });
  assert.equal(isOverdueFollowUp(l, new Date('2026-11-05T18:00:00.000Z')), false); assert.equal(isOverdueFollowUp(l, new Date('2026-11-05T18:31:00.000Z')), true);
});
test('"decide later" (or no visit set) is overdue after 3 days of silence; a newer update restarts that clock', () => {
  const l = fu({ visitIntention: 'LATER' });
  assert.equal(isOverdueFollowUp(l, plus(3 * 24 * 60 - 5)), false); assert.equal(isOverdueFollowUp(l, plus(3 * 24 * 60 + 5)), true);
  const updated = fu({ visitIntention: 'LATER', lastActivityAt: plus(3 * 24 * 60) });
  assert.equal(isOverdueFollowUp(updated, plus(3 * 24 * 60 + 5)), false);
});
test('closed, not-interested and never-answered leads are never "overdue follow-ups"', () => {
  const late = plus(30 * 24 * 60);
  assert.equal(isOverdueFollowUp(fu({ conversion: 'CLOSED' }), late), false); assert.equal(isOverdueFollowUp(fu({ conversion: 'NOT_INTERESTED' }), late), false);
  assert.equal(isOverdueFollowUp(fu({ firstResponseAt: null }), late), false); assert.equal(isOverdueFollowUp(fu({ conversion: 'NOT_CLOSED' }), late), true);
});

/* ── report numbers ── */
const rows: ReportLead[] = [
  fu({ interest: 'HOT', visitIntention: 'TODAY', visitUpdatedAt: T0, conversion: 'CLOSED' }),
  fu({ interest: 'WARM', visitIntention: 'TOMORROW', visitUpdatedAt: T0, conversion: 'NOT_CLOSED' }),
  fu({ interest: 'COLD', conversion: 'NOT_INTERESTED' }),
  fu({ interest: 'HOT', visitIntention: 'LATER', visitUpdatedAt: T0 }),
  fu({ firstResponseAt: null, assignedAt: plus(-25) }),
  fu({ firstResponseAt: null, assignedAt: plus(-45) }),
  fu({ firstResponseAt: null, assignedAt: plus(-5) }),
];
test('the store report counts every box correctly', () => {
  const s = summarise(rows, T0);
  assert.equal(s.total, 7); assert.equal(s.hot, 2); assert.equal(s.warm, 1); assert.equal(s.cold, 1);
  assert.equal(s.closed, 1); assert.equal(s.notClosed, 1); assert.equal(s.notInterested, 1); assert.equal(s.undecided, 4);
  assert.equal(s.visitToday, 0, 'a closed lead is not an expected visit'); assert.equal(s.visitTomorrow, 1); assert.equal(s.visitLater, 1);
  assert.equal(s.pendingFirstResponse, 3); assert.equal(s.pendingOver20, 2); assert.equal(s.pendingOver40, 1);
  assert.equal(s.conversionPercent, 14.3);
});
test('an empty report is all zeros, and a 0% conversion does not divide by zero', () => { const s = summarise([], T0); assert.equal(s.total, 0); assert.equal(s.conversionPercent, 0); });
test('grouping by store gives each store its own numbers, biggest first', () => {
  const tagged = [{ ...rows[0], pos: 'TAM' }, { ...rows[1], pos: 'TAM' }, { ...rows[2], pos: 'OMR' }];
  const g = summariseBy(tagged, (l) => l.pos, (l) => l.pos, T0);
  assert.deepEqual(g.map((x) => [x.key, x.summary.total]), [['TAM', 2], ['OMR', 1]]); assert.equal(g[0].summary.closed, 1);
});

/* ── access control ── */
test('a STORE login can use only its own leads pages and APIs', () => {
  for (const [path, method] of [['/store-leads', 'GET'], ['/api/store/leads', 'GET'], ['/api/store/leads/x', 'GET'], ['/api/store/leads/x', 'PATCH'], ['/api/lead-alerts', 'GET'], ['/api/lead-alerts/read', 'POST'], ['/', 'GET'], ['/account', 'GET'], ['/api/me', 'GET'], ['/api/logout', 'POST']] as const)
    assert.equal(canAccess('STORE', path, method), true, `${method} ${path}`);
});
test('a STORE login is refused everything else: finder, stock, offers, billing, sharing, the admin area, deleting', () => {
  for (const [path, method] of [['/locator', 'GET'], ['/stock', 'GET'], ['/products', 'GET'], ['/my-leads', 'GET'], ['/billing-notes', 'GET'], ['/share-lead', 'GET'], ['/api/stores/search', 'GET'], ['/api/offers', 'GET'], ['/api/products', 'GET'], ['/api/chat', 'POST'],
    ['/api/billing-notes', 'GET'], ['/api/store-leads', 'POST'], ['/api/store-leads', 'GET'], ['/api/leads', 'POST'], ['/api/my/leads', 'GET'], ['/admin', 'GET'], ['/admin/users', 'GET'], ['/admin/store-leads', 'GET'], ['/api/admin/store-leads', 'GET'], ['/api/admin/store-accounts', 'POST'],
    ['/api/store/leads/x', 'DELETE'], ['/api/store/leads/x', 'PUT'], ['/api/store/leads', 'POST']] as const)
    assert.equal(canAccess('STORE', path, method), false, `${method} ${path}`);
});
test('a SALES user can share and follow their own leads, but cannot open the store side or the admin side', () => {
  assert.equal(canAccess('SALES', '/share-lead', 'GET'), true); assert.equal(canAccess('SALES', '/api/store-leads', 'POST'), true); assert.equal(canAccess('SALES', '/api/store-leads', 'GET'), true); assert.equal(canAccess('SALES', '/api/store-leads/stores', 'GET'), true);
  for (const [path, method] of [['/store-leads', 'GET'], ['/api/store/leads', 'GET'], ['/api/store/leads/x', 'PATCH'], ['/api/lead-alerts', 'GET'], ['/admin/store-leads', 'GET'], ['/api/admin/store-leads', 'GET'], ['/admin/store-accounts', 'GET'], ['/api/admin/store-accounts', 'POST']] as const)
    assert.equal(canAccess('SALES', path, method), false, `${method} ${path}`);
});
test('an admin can reach everything', () => { for (const p of ['/admin/store-leads', '/api/admin/store-leads', '/api/store/leads/x', '/share-lead', '/store-leads']) assert.equal(canAccess('ADMIN', p, 'GET'), true); });
test('STORE is a real role, but the Users page cannot assign it (it is created from Store accounts, tied to one store)', () => {
  assert.equal(isRole('STORE'), true); assert.equal(isRole('BOSS'), false);
  assert.deepEqual([...ASSIGNABLE_ROLES], ['ADMIN', 'SALES']); assert.equal(parseRole('STORE'), null); assert.equal(parseRole('SALES'), 'SALES'); assert.equal(parseRole('ADMIN'), 'ADMIN');
});

test('store usernames come from the POS code and always satisfy the username rules', () => {
  assert.equal(usernameForStore('PBZ1'), 'store.pbz1'); assert.equal(usernameForStore('IND 1'), 'store.ind1'); assert.equal(usernameForStore('CBE-7'), 'store.cbe7'); assert.equal(usernameForStore('TAM'), 'store.tam');
  for (const c of ['PBZ1', 'IND 1', 'CBE-7', 'TAM', 'OMR', 'AVD']) assert.match(usernameForStore(c), /^[a-z0-9][a-z0-9._-]{2,31}$/);
});

console.log(`\n${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
