import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialAccount, parsePoundsToPence, getGaugeState } from './account.js';

// Run with npm test. Each assertion checks an expected calculation or boundary.
test('safe to spend = safe limit (target share of the card limit) minus what you owe', () => {
  const state = createInitialAccount();
  const now = getGaugeState(state.balance, state.limit, state.target);
  assert.equal(now.threshold, 30000);   // 30% of £1,000
  assert.equal(now.safeToSpend, 2000);  // £300 − £280
  assert.equal(now.over, 0);
  const after = getGaugeState(state.balance + parsePoundsToPence('50'), state.limit, state.target);
  assert.equal(after.safeToSpend, 0);
  assert.equal(after.over, 3000);       // £30 over the safe limit
  assert.equal(after.label, 'Over your safe limit');
  assert.equal(getGaugeState(108000, state.limit, state.target).label, 'Over your card limit');
  assert.equal(getGaugeState(-500, state.limit, state.target).safeToSpend, 30000);  // credit balance owes nothing
  // Preview calculations must leave the original balance unchanged.
  assert.equal(state.balance, 28000);
  // Accept valid pennies, but reject amounts with more than two decimal places.
  assert.equal(parsePoundsToPence('12.05'), 1205);
  assert.equal(parsePoundsToPence('12.005'), null);
  assert.equal(parsePoundsToPence(' .50 '), 50);
  assert.equal(parsePoundsToPence('12.'), 1200);
  assert.equal(parsePoundsToPence(null), null);
});

// Same bands as the extension (checkout-guard/core.js impact): green below 80% of the
// safe limit, amber up to it, red over it. The bar never goes past full.
test('colours and bar follow the safe limit, matching the extension', () => {
  for (const [balance, zone, label, width] of [
    [0, 'green', 'Within your safe limit', 0],
    [23999, 'green', 'Within your safe limit', 23999 / 300],
    [24000, 'amber', 'Close to your safe limit', 80],
    [30000, 'amber', 'Close to your safe limit', 100],
    [30001, 'red', 'Over your safe limit', 100],
    [110000, 'red', 'Over your card limit', 100],
  ]) {
    const result = getGaugeState(balance, 100000, 30);
    assert.deepEqual([result.zone, result.label, result.width], [zone, label, width], String(balance));
  }
  assert.equal(getGaugeState(20000, 100000, 25).zone, 'amber');  // a lower target tightens the bands
});
