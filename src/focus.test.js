import test from 'node:test';
import assert from 'node:assert/strict';
import { focusSummary } from './focus.js';
import { createInitialAccount } from './account.js';

test('focus uses the shared gauge and only selected current-month spending', () => {
  const account = { ...createInitialAccount(), balance: 31000 };
  const rows = [
    { isoDate: '2026-11-01', amount: 1001, category: 'Groceries' },
    { isoDate: '2026-11-02', amount: 1999, category: 'Groceries' },
    { isoDate: '2026-11-03', amount: 500, category: 'Shopping' },
    { isoDate: '2026-11-03', amount: 9000, category: 'Shopping', included: false },
    { isoDate: '2025-11-01', amount: 9000, category: 'Shopping' },
    { isoDate: null, amount: 9000, category: 'Shopping' },
  ];
  const before = JSON.stringify(rows);
  const result = focusSummary(account, rows, '2026-11');
  assert.equal(result.owed, 31000);
  assert.equal(result.safeToSpend, 0);
  assert.equal(result.label, 'Over your safe limit');
  assert.equal(result.spending, 3500);
  assert.deepEqual(result.topCategory, { category: 'Groceries', amount: 3000, count: 2 });
  assert.equal(JSON.stringify(rows), before);
});

test('empty focus summary does not suggest missing data means no spending', () => {
  const result = focusSummary(createInitialAccount(), [], '2026-11');
  assert.equal(result.safeToSpend, 2000);
  assert.equal(result.count, 0);
  assert.equal(result.topCategory, null);
});
