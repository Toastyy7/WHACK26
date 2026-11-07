import test from 'node:test';
import assert from 'node:assert/strict';
import { findStatementPeriod, normalizeTransactionDate, filterByMonth, groupByDate, formatDate } from './dates.js';

const period = { start: '2026-12-08', end: '2027-01-07' };
test('dates use statement years across December and January, not the current year', () => {
  assert.deepEqual(findStatementPeriod([[{ text: '8 December to 7 January 2027' }]]), period);
  assert.equal(normalizeTransactionDate('20 Dec', period), '2026-12-20');
  assert.equal(normalizeTransactionDate('04 Jan', period), '2027-01-04');
  assert.equal(normalizeTransactionDate('04 Jan 27'), '2027-01-04');
  assert.equal(normalizeTransactionDate('04/01/2027'), '2027-01-04');
  assert.equal(normalizeTransactionDate('20 Dec'), null);
  assert.equal(normalizeTransactionDate('31 Feb 26'), null);
  assert.equal(normalizeTransactionDate('29 Feb 24'), '2024-02-29');
  assert.equal(normalizeTransactionDate('02 Feb', period), null);
  assert.equal(formatDate('2027-01-04'), '4 Jan 2027');
});

test('month filters and daily groups preserve totals and keep unknown dates visible', () => {
  const rows = [
    { isoDate: '2027-01-04', amount: 100 },
    { isoDate: '2026-12-20', amount: 200 },
    { isoDate: '2027-01-04', amount: 300 },
    { isoDate: null, amount: 50 },
  ];
  assert.equal(filterByMonth(rows, 'all').length, 4);
  assert.equal(filterByMonth(rows, '2027-01').reduce((sum, row) => sum + row.amount, 0), 400);
  assert.equal(filterByMonth(rows, 'undated').length, 1);
  assert.deepEqual(groupByDate(rows), [
    { date: '2026-12-20', amount: 200, count: 1 },
    { date: '2027-01-04', amount: 400, count: 2 },
    { date: 'undated', amount: 50, count: 1 },
  ]);
});
