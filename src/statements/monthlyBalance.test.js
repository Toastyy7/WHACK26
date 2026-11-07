import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyBalance, currentMonth } from './monthlyBalance.js';
import { setTransactionIncluded } from './selection.js';

test('deducts only included transactions from the current month and year', () => {
  const rows = [
    { id: 'a', isoDate: '2026-11-01', amount: 1000 },
    { id: 'b', isoDate: '2026-11-07', amount: 2500 },
    { isoDate: '2026-11-05', amount: 9000, included: false },
    { isoDate: '2026-10-31', amount: 8000 },
    { isoDate: '2025-11-07', amount: 8000 },
    { isoDate: null, amount: 8000 },
  ];
  assert.deepEqual(monthlyBalance(28000, rows, '2026-11'), { balance: 24500, outgoing: 3500 });
  assert.equal(monthlyBalance(28000, rows, '2026-11').balance, 24500);
  const removed = setTransactionIncluded({ result: { transactions: rows } }, 'a', false);
  assert.equal(monthlyBalance(28000, removed.result.transactions, '2026-11').balance, 25500);
  const restored = setTransactionIncluded(removed, 'a', true);
  assert.equal(monthlyBalance(28000, restored.result.transactions, '2026-11').balance, 24500);
  assert.equal(monthlyBalance(28000, [], '2026-11').balance, 28000);
});

test('month changes and deductions larger than the balance use exact arithmetic', () => {
  assert.equal(currentMonth(new Date(2026, 10, 7)), '2026-11');
  assert.equal(currentMonth(new Date(2027, 0, 1)), '2027-01');
  const rows = [{ isoDate: '2026-12-31', amount: 1500 }];
  assert.equal(monthlyBalance(1000, rows, '2026-12').balance, -500);
  assert.equal(monthlyBalance(1000, rows, '2027-01').balance, 1000);
});
