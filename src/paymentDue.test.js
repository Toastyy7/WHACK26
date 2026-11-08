import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePaymentDue, paymentTiming, localDay, loadPaymentDue, savePaymentDue } from './paymentDue.js';
import { scopedStorage } from './auth/scopedStorage.js';

test('payment amounts use pence and dates must be real calendar days', () => {
  assert.deepEqual(parsePaymentDue('25.01', '2028-02-29'), { amount: 2501, date: '2028-02-29' });
  for (const amount of ['', '0', '-1', '1.234', 'abc']) assert.equal(parsePaymentDue(amount, '2026-11-08'), null);
  for (const date of ['', '2026-02-29', '2026-04-31', '08/11/2026', '0000-01-01']) assert.equal(parsePaymentDue('25', date), null);
});
test('timing counts calendar days across daylight saving, month and year boundaries', () => {
  assert.equal(paymentTiming('2026-11-08', '2026-11-08'), 'Due today');
  assert.equal(paymentTiming('2026-11-09', '2026-11-08'), 'Due in 1 day');
  assert.equal(paymentTiming('2026-11-13', '2026-11-08'), 'Due in 5 days');
  assert.equal(paymentTiming('2026-11-07', '2026-11-08'), 'Past due date');
  assert.equal(paymentTiming('2027-01-01', '2026-12-31'), 'Due in 1 day');
  assert.equal(paymentTiming('2026-03-30', '2026-03-28'), 'Due in 2 days');
  assert.equal(localDay(new Date(2026, 10, 8, 23, 59)), '2026-11-08');
});
test('payment data persists separately per account, validates stored data and clears', () => {
  const data = new Map();
  const base = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
  const a = scopedStorage(() => base, 'a');
  const b = scopedStorage(() => base, 'b');
  const payment = { amount: 2500, date: '2026-11-08' };
  savePaymentDue(a, payment);
  assert.deepEqual(loadPaymentDue(a), payment);
  assert.equal(loadPaymentDue(b), null);
  savePaymentDue(a, null);
  assert.equal(loadPaymentDue(a), null);
  for (const value of ['{', '{}', '{"amount":1.5,"date":"2026-11-08"}', '{"amount":2500,"date":"2026-02-30"}']) {
    a.setItem('credit-guard-payment-due-v1', value);
    assert.equal(loadPaymentDue(a), null);
  }
  assert.throws(() => savePaymentDue({ setItem() { throw Error('blocked'); } }, payment), /blocked/);
});

test('grace extends fourteen calendar days after the later of today or due date', async () => {
  const { extendPaymentDue } = await import('./paymentDue.js');
  const original = { amount: 2501, date: '2026-11-13' };
  assert.deepEqual(extendPaymentDue(original, '2026-11-08'), { amount: 2501, date: '2026-11-27' });
  assert.equal(original.date, '2026-11-13');
  assert.equal(extendPaymentDue({ ...original, date: '2026-11-01' }, '2026-11-08').date, '2026-11-22');
  assert.equal(extendPaymentDue({ ...original, date: '2026-11-08' }, '2026-11-08').date, '2026-11-22');
  assert.equal(extendPaymentDue({ ...original, date: '2026-12-25' }, '2026-11-08').date, '2027-01-08');
  assert.equal(extendPaymentDue({ ...original, date: '2028-02-20' }, '2028-02-19').date, '2028-03-05');
  assert.equal(extendPaymentDue({ ...original, date: '2026-03-28' }, '2026-03-27').date, '2026-04-11');
  assert.equal(extendPaymentDue(null, '2026-11-08'), null);
  assert.equal(extendPaymentDue(original, 'invalid'), null);
  assert.equal(extendPaymentDue({ ...original, date: '9999-12-31' }, '2026-11-08'), null);
});
