import test from 'node:test';
import assert from 'node:assert/strict';
import { getDemoStatement } from './demoStatement.js';
import { categories } from './categories.js';

test('demo statement provides valid categorized transactions with matching declared total', () => {
  const statement = getDemoStatement();
  assert.ok(Array.isArray(statement.transactions));
  assert.equal(statement.transactions.length, 9);

  const calculatedTotal = statement.transactions.reduce((sum, tx) => sum + tx.amount, 0);
  assert.equal(calculatedTotal, statement.declaredTotal);
  assert.equal(statement.declaredTotal, 21348); // £213.48

  // Every transaction must have valid fields
  for (const tx of statement.transactions) {
    assert.ok(tx.id);
    assert.ok(tx.date);
    assert.ok(tx.description);
    assert.ok(Number.isSafeInteger(tx.amount) && tx.amount > 0);
    assert.ok(categories.includes(tx.category), tx.category);  // must match a real dropdown option
    assert.equal(tx.included, true);
  }
});
