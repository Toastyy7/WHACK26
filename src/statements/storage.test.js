import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStatement, saveStatement } from './storage.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
const statement = { fileName: 'example.pdf', savedAt: 123, result: { transactions: [
  { id: '1', date: '1 Jan 26', isoDate: '2026-01-01', description: 'Cafe', category: 'Takeaways & dining', amount: 300 },
] } };

test('saved results survive reloading, category edits persist, and clearing removes storage', () => {
  const storage = memoryStorage();
  saveStatement(storage, statement);
  assert.deepEqual(loadStatement(storage).result, statement.result);
  const edited = structuredClone(statement);
  edited.result.transactions[0].category = 'Other / needs review';
  saveStatement(storage, edited);
  assert.equal(loadStatement(storage).result.transactions[0].category, 'Other / needs review');
  saveStatement(storage, null);
  assert.equal(loadStatement(storage), null);
});

test('invalid and unavailable storage do not crash loading', () => {
  assert.equal(loadStatement({ getItem: () => 'invalid json' }), null);
  assert.equal(loadStatement({ getItem: () => JSON.stringify({ version: 1, fileName: 'bad', result: { transactions: [{}] } }) }), null);
  assert.equal(loadStatement({ getItem: () => { throw new Error('Storage disabled'); } }), null);
});
