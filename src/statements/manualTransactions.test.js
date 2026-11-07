import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualTransaction, appendManualTransaction, importedTransactions } from './manualTransactions.js';
import { monthlyBalance } from './monthlyBalance.js';
import { saveStatement, loadStatement } from './storage.js';

const fields = { category: 'Takeaways & dining', price: '12.05', merchant: '  Example Cafe  ', date: '2026-11-07' };
test('manual payments work without a PDF, persist and affect the dated balance', () => {
  const row = createManualTransaction(fields, 'manual-one');
  assert.equal(row.amount, 1205);
  assert.equal(row.description, 'Example Cafe');
  assert.equal(row.isoDate, '2026-11-07');
  const saved = appendManualTransaction(null, row);
  assert.equal(saved.result.transactions.length, 1);
  assert.deepEqual(importedTransactions(saved.result.transactions), []);
  assert.equal(monthlyBalance(28000, saved.result.transactions, '2026-11').balance, 26795);
  let json;
  const storage = { setItem: (_, value) => { json = value; }, getItem: () => json };
  saveStatement(storage, saved);
  assert.equal(loadStatement(storage).result.transactions[0].source, 'manual');
});

test('adding a payment preserves imported rows and the PDF summary', () => {
  const imported = { id: 'pdf-one', amount: 1000 };
  const statement = { fileName: 'test.pdf', result: { declaredTotal: 1000, transactions: [imported] } };
  const updated = appendManualTransaction(statement, createManualTransaction(fields, 'manual-two'));
  assert.equal(updated.result.transactions.length, 2);
  assert.equal(statement.result.transactions.length, 1);
  assert.equal(updated.result.declaredTotal, 1000);
  assert.equal(importedTransactions(updated.result.transactions).reduce((sum, row) => sum + row.amount, 0), 1000);
});

test('manual entry rejects invalid money, missing merchant, type or date', () => {
  for (const override of [
    { price: '0' }, { price: '-1' }, { price: '12.005' }, { price: '' },
    { merchant: '  ' }, { category: 'invalid' }, { date: '' }, { date: '2026-02-30' },
  ]) assert.throws(() => createManualTransaction({ ...fields, ...override }, 'invalid'));
});
