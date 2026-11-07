import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialAccount, parsePoundsToPence, getGaugeState } from './account.js';

// Run with npm test. Each assertion checks an expected calculation or boundary.
test('purchase preview is pure and handles the target and half-limit boundaries', () => {
  const state = createInitialAccount();
  assert.equal(
    getGaugeState(state.balance, state.limit, state.target).label,
    'Within your target',
  );
  assert.equal(
    getGaugeState(30000, state.limit, state.target).label,
    'At or above your target',
  );
  assert.equal(
    getGaugeState(state.balance + parsePoundsToPence('50'), state.limit, state.target).percentage,
    33,
  );
  assert.equal(
    getGaugeState(50000, state.limit, state.target).label,
    'Using at least half your limit',
  );
  // Preview calculations must leave the original balance unchanged.
  assert.equal(state.balance, 28000);
  // Accept valid pennies, but reject amounts with more than two decimal places.
  assert.equal(parsePoundsToPence('12.05'), 1205);
  assert.equal(parsePoundsToPence('12.005'), null);
});

// Check exact boundaries, including an over-limit balance and a custom target.
test('gauge colours follow the target and half-limit boundaries', () => {
  for (const [balance, target, expectedZone] of [
    [0, 30, 'green'],
    [29999, 30, 'green'],
    [30000, 30, 'amber'],
    [49999, 30, 'amber'],
    [50000, 30, 'red'],
    [110000, 30, 'red'],
    [24999, 25, 'green'],
    [25000, 25, 'amber'],
  ]) {
    assert.equal(getGaugeState(balance, 100000, target).zone, expectedZone);
  }
});
