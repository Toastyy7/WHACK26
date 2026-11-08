import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from './format.js';

// Same shape as the extension (always pence): "£280.5" is easy to misread.
test('money always shows pounds and two-digit pence', () => {
  assert.equal(formatMoney(28050), '£280.50');
  assert.equal(formatMoney(28000), '£280.00');
  assert.equal(formatMoney(5), '£0.05');
  assert.equal(formatMoney(100000), '£1,000.00');
});
