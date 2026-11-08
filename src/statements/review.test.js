import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewRows, reviewedResult } from './review.js';
const result = { declaredTotal: 1500, transactions: [
  { id: 'a', amount: 1000, isoDate: '2026-11-01', description: 'Shop', category: 'Shopping', confidence: 95 },
  { id: 'b', amount: 500, isoDate: null, description: 'Cafe', category: 'Takeaways & dining', confidence: 30 },
] };
test('review is separate from saved amounts and uncertain rows are not silently selected', () => {
  const rows = reviewRows(result);
  assert.equal(rows[0].included, true);
  assert.equal(rows[1].included, false);
  rows[0].price = '12.34';
  rows[0].description = 'Corrected shop';
  const reviewed = reviewedResult(result, rows);
  assert.equal(reviewed.transactions[0].amount, 1234);
  assert.equal(result.transactions[0].amount, 1000);
  assert.equal(reviewed.declaredTotal, 1500);
});
test('selected OCR rows cannot import invalid amounts or dates', () => {
  for (const patch of [{ price: '0' }, { price: '-1' }, { price: '1.234' }, { isoDate: '2026-02-30' }, { description: ' ' }]) {
    const rows = reviewRows(result); Object.assign(rows[0], patch);
    assert.throws(() => reviewedResult(result, rows));
  }
});
