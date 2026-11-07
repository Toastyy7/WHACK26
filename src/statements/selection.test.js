import test from 'node:test';
import assert from 'node:assert/strict';
import { includedTransactions, setTransactionIncluded } from './selection.js';
import { loadStatement, saveStatement } from './storage.js';

test('remove and restore one transaction without losing imported rows or changing reconciliation', () => {
  const row = { date: '1 Jan 26', isoDate: '2026-01-01', description: 'Cafe', category: 'Takeaways & dining', amount: 500 };
  const original = { fileName: 'test.pdf', result: { declaredTotal: 1000, transactions: [{ ...row, id: 'one' }, { ...row, id: 'two' }] } };
  const removed = setTransactionIncluded(original, 'one', false);
  assert.deepEqual(includedTransactions(removed.result.transactions).map((item) => item.id), ['two']);
  assert.equal(removed.result.transactions.length, 2);
  assert.equal(removed.result.declaredTotal, 1000);
  assert.equal(original.result.transactions[0].included, undefined);
  let saved;
  const storage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  saveStatement(storage, removed);
  const reloaded = loadStatement(storage);
  assert.equal(includedTransactions(reloaded.result.transactions).length, 1);
  const restored = setTransactionIncluded(reloaded, 'one', true);
  assert.equal(includedTransactions(restored.result.transactions).reduce((sum, item) => sum + item.amount, 0), 1000);
  const empty = setTransactionIncluded(removed, 'two', false);
  assert.deepEqual(includedTransactions(empty.result.transactions), []);
});
