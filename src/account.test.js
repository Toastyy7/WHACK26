import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initial,
  pence,
  gauge,
  runPayment,
  generateSupportDraft,
  removeCoolingItem,
} from './account.js';

test('purchase preview is pure and handles the target and half-limit boundaries', () => {
  const state = initial();
  assert.equal(state.cardholder, 'Emil');
  assert.equal(
    gauge(state.balance, state.limit, state.target).label,
    'Within your target',
  );
  assert.equal(
    gauge(30000, state.limit, state.target).label,
    'At or above your target',
  );
  assert.equal(
    gauge(state.balance + pence('50'), state.limit, state.target).percentage,
    33,
  );
  assert.equal(
    gauge(50000, state.limit, state.target).label,
    'Using at least half your limit',
  );
  assert.equal(state.balance, 28000);
  assert.equal(pence('12.05'), 1205);
  assert.equal(pence('12.005'), null);
});

test('weekly checks post once, preserve the buffer and update the minimum', () => {
  const state = { ...initial(), plan: 'active' };
  const first = runPayment(state);
  assert.deepEqual(
    [first.balance, first.bank, first.minimum],
    [27000, 6500, 1500],
  );
  assert.equal(runPayment(first), first);
  const second = runPayment({ ...first, bank: 5500, week: 2 });
  assert.deepEqual(
    [second.balance, second.bank, second.minimum],
    [27000, 5500, 1500],
  );
  assert.equal(second.payments[0].status, 'skipped');
  assert.equal(runPayment({ ...state, bank: 6000 }).bank, 5000);
});

test('paused, stale, unavailable and failed checks cannot deduct money', () => {
  const state = { ...initial(), plan: 'active' };
  const paused = { ...state, plan: 'paused' };
  assert.equal(runPayment(paused), paused);
  for (const [override, fail, status] of [
    [{ freshness: 'stale' }, false, 'skipped'],
    [{ freshness: 'missing' }, false, 'skipped'],
    [{}, true, 'failed'],
  ]) {
    const result = runPayment({ ...state, ...override }, fail);
    assert.equal(result.payments[0].status, status);
    assert.deepEqual(
      [result.balance, result.bank, result.minimum],
      [28000, 7500, 2500],
    );
  }
});

test('assisted support draft generates authentic message with user parameters', () => {
  const draft = generateSupportDraft({
    cardholder: 'Emil',
    reasonKey: 'unexpected_expense',
    amountAffordable: 1000,
    minimum: 2500,
    due: '14 November',
    recoveryDate: '1 December',
  });

  assert.match(draft, /Dear Capital One Support Team/);
  assert.match(draft, /essential unexpected repair/);
  assert.match(draft, /statement minimum of £25\.00 due on 14 November/);
  assert.match(draft, /able to pay £10\.00 right now/);
  assert.match(draft, /stabilize by 1 December/);
  assert.match(draft, /Yours faithfully,\nEmil/);
});

test('removing cooling items updates impulse savings and leaves queue clean', () => {
  const state = initial();
  assert.equal(state.coolingItems.length, 1);
  assert.equal(state.impulseSavings, 0);

  const updated = removeCoolingItem(state, 'cool-001');
  assert.equal(updated.coolingItems.length, 0);
  assert.equal(updated.impulseSavings, 6999); // £69.99 saved

  // Removing non-existent item is a no-op
  assert.equal(removeCoolingItem(updated, 'invalid-id'), updated);
});
