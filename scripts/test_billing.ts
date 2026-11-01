/** Checks for the billing-notes rules. Run with: npm run test:billing */
import assert from 'node:assert/strict';
import { checkNote, formatPhone, normalizePhone, parseSearch } from '../lib/billing/validate';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log('ok   -', name); } catch (e) { process.exitCode = 1; console.log('FAIL -', name, '\n      ', (e as Error).message.split('\n').slice(0, 3).join('\n       ')); }
}
const TODAY = '2026-09-22';
const base = { bookingDate: '2026-09-22', billedPhone: '9790909191', dialledPhone: '9940127048', model: '18', customerName: 'Papilasa', location: 'tam', status: 'NOT_BILLED', agentCode: 'Doocti' };
const bad = (o: Record<string, unknown>, re: RegExp) => { const r = checkNote({ ...base, ...o }, TODAY); assert.ok(!r.ok, 'should be refused'); if (!r.ok) assert.ok(r.errors.some((e) => re.test(e)), r.errors.join(' | ')); };

test('phone numbers written many ways become the same 10 digits', () => {
  for (const v of ['99866 64876', '+91 99866-64876', '099866 64876', '(+91)9986664876', ' 9986664876 ', 919986664876]) assert.equal(normalizePhone(v), '9986664876', String(v));
});
test('bad phone numbers are refused: too short, too long, wrong start, letters', () => {
  for (const v of ['967988808', '97360936', '12345678901', '5123456789', 'abc', '', null, '226-9-26']) assert.equal(normalizePhone(v), null, String(v));
});
test('phones are shown as 5 + 5 digits', () => assert.equal(formatPhone('9986664876'), '99866 64876'));

test('a row like the sheet\'s (Papilasa, 18, TAM, not billed) is accepted and tidied', () => {
  const r = checkNote(base, TODAY);
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.data.location, 'TAM'); assert.equal(r.data.status, 'NOT_BILLED'); assert.equal(r.data.value, null); assert.equal(r.data.invoice, null); }
});
test('the customer name may be blank (one row in the sheet has none)', () => assert.ok(checkNote({ ...base, customerName: '' }, TODAY).ok));
test('billed and dialled numbers must differ, even if written differently', () => {
  bad({ dialledPhone: '97909 09191' }, /same/);
  bad({ dialledPhone: '+91 9790909191' }, /same/);
});
test('phone numbers are optional, but one that IS typed must be a real mobile', () => {
  assert.ok(checkNote({ ...base, billedPhone: '' }, TODAY).ok);
  assert.ok(checkNote({ ...base, dialledPhone: '' }, TODAY).ok);
  bad({ billedPhone: '9790909' }, /Billed phone number must be a 10-digit/);
  bad({ dialledPhone: '967988808' }, /Dialled phone number must be a 10-digit/);
});
test('everything is optional: a note with just a remark, just a name, just a model, or just one number is fine', () => {
  for (const f of [{ remarks: 'call back' }, { customerName: 'Nikitha' }, { model: 'M5 Air' }, { billedPhone: '9790909191' }, { invoice: 'INV-9' }, { value: '5000' }]) {
    const r = checkNote(f, TODAY); assert.ok(r.ok, JSON.stringify(f));
  }
});
test('a note with nothing at all filled in is refused (it would be an empty row)', () => {
  for (const e of [{}, { bookingDate: '2026-09-22' }, { status: 'NOTED', customerName: '  ', remarks: '' }]) {
    const r = checkNote(e, TODAY); assert.ok(!r.ok, JSON.stringify(e)); if (!r.ok) assert.match(r.errors[0], /at least one detail/);
  }
});
test('a blank date means today', () => {
  const r = checkNote({ remarks: 'x' }, TODAY); assert.ok(r.ok); if (r.ok) assert.equal(r.data.bookingDate, TODAY);
});
test('the date must be real, not in the future, not ancient (the sheet had "226-9-26")', () => {
  bad({ bookingDate: '226-9-26' }, /not a real date/);
  bad({ bookingDate: '2026-02-30' }, /not a real date/);
  bad({ bookingDate: '2026-09-23' }, /future/);
  bad({ bookingDate: '2019-12-31' }, /too old/);
  assert.ok(checkNote({ ...base, bookingDate: '2026-09-22' }, TODAY).ok, 'today is fine');
});
test('location must look like a store code', () => {
  bad({ location: 'Tambaram branch!' }, /store code/);
  assert.ok(checkNote({ ...base, model: '' }, TODAY).ok);
});
test('Billed does not force an invoice number (everything is optional); with one, the value parses', () => {
  assert.ok(checkNote({ ...base, status: 'BILLED', invoice: '' }, TODAY).ok);
  const r = checkNote({ ...base, status: 'BILLED', invoice: 'INV-2026-0042', value: '₹1,24,900' }, TODAY);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.value, 124900);
});
test('status words from the screen are understood; junk is refused', () => {
  const r = checkNote({ ...base, status: 'Not billed' }, TODAY);
  assert.ok(r.ok); if (r.ok) assert.equal(r.data.status, 'NOT_BILLED');
  bad({ status: 'Pending' }, /Status must be/);
});
test('value must be rupees: negative, text and absurd amounts are refused', () => {
  bad({ value: '-5' }, /Value/); bad({ value: 'lots' }, /Value/); bad({ value: 99999999999 }, /Value/);
  const r = checkNote({ ...base, value: '89900.40' }, TODAY); assert.ok(r.ok); if (r.ok) assert.equal(r.data.value, 89900);
});
test('over-long text is refused with the limit named', () => {
  bad({ remarks: 'x'.repeat(501) }, /500/); bad({ customerName: 'n'.repeat(81) }, /80/); bad({ invoice: 'i'.repeat(41) }, /40/);
});
test('several problems are reported together, so they can be fixed in one go', () => {
  const r = checkNote({ bookingDate: '2099-01-01', billedPhone: '1', dialledPhone: '2', value: 'lots', status: 'Pending' }, TODAY);
  assert.ok(!r.ok); if (!r.ok) assert.ok(r.errors.length >= 5, r.errors.join('|'));
});
test('the search box tells a phone number from words', () => {
  assert.deepEqual(parseSearch('99866 64876'), { digits: '9986664876', words: [] });
  assert.deepEqual(parseSearch('+91 9986664876'), { digits: '9986664876', words: [] });
  assert.deepEqual(parseSearch('9986'), { digits: '9986', words: [] });
  assert.deepEqual(parseSearch('Nikitha M5 air'), { digits: null, words: ['nikitha', 'm5', 'air'] });
  assert.deepEqual(parseSearch('INV-2026-0042'), { digits: null, words: ['inv-2026-0042'] });
  assert.deepEqual(parseSearch('123'), { digits: null, words: ['123'] });
});

console.log(`\n${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
