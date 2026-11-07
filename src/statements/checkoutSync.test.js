import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { receiveCheckout, checkoutTransaction } from './checkoutSync.js';
import { monthlyBalance } from './monthlyBalance.js';
import { loadStatement, saveStatement } from './storage.js';
import { importedTransactions } from './manualTransactions.js';

const purchase = { version: 1, id: 'purchase-one', amount: 6999, currency: 'GBP', merchant: 'example.shop', date: '2026-11-07' };
function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

test('checkout adds a dated transaction, deducts once, and does not alter PDF reconciliation', () => {
  const storage = memoryStorage();
  const initial = { fileName: 'statement.pdf', result: { transactions: [{ id: 'pdf-row', amount: 1000, date: '1 Oct 26', isoDate: '2026-10-01', description: 'Groceries', category: 'Groceries' }], declaredTotal: 1000 } };
  saveStatement(storage, initial);
  const next = receiveCheckout(storage, initial, purchase);
  assert.equal(next.result.transactions.length, 2);
  assert.equal(next.result.transactions[1].source, 'checkout');
  assert.equal(next.result.transactions[1].status, 'planned');
  assert.equal(monthlyBalance(28000, next.result.transactions, '2026-11').balance, 21001);
  assert.equal(importedTransactions(next.result.transactions).length, 1);
  assert.equal(receiveCheckout(storage, next, purchase).result.transactions.length, 2);
  assert.equal(loadStatement(storage).result.transactions.length, 2);
  // Reset clears transactions; a delayed delivery retry must not resurrect them.
  saveStatement(storage, null);
  assert.equal(receiveCheckout(storage, null, purchase), null);
});

test('distinct same-price checkouts remain distinct; invalid or unsaved events are not accepted', () => {
  const storage = memoryStorage();
  const first = receiveCheckout(storage, null, purchase);
  const second = receiveCheckout(storage, first, { ...purchase, id: 'purchase-two' });
  assert.equal(second.result.transactions.length, 2);
  for (const override of [{ amount: -1 }, { currency: 'USD' }, { date: '2026-02-30' }, { merchant: '' }, { id: '../bad' }]) {
    assert.throws(() => checkoutTransaction({ ...purchase, ...override }));
  }
  assert.throws(() => receiveCheckout({ getItem: () => null, setItem: () => { throw new Error('Storage full'); } }, null, purchase));
});

function extensionStorage() {
  const data = {};
  const listeners = [];
  const local = {
    async get(keys) {
      if (keys === null) return { ...data };
      if (typeof keys === 'object') return { ...keys, ...data };
      return { [keys]: data[keys] };
    },
    async set(values) {
      Object.assign(data, values);
      for (const listener of listeners) listener(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])), 'local');
    },
    async remove(key) { delete data[key]; },
  };
  return { storage: { local, onChanged: { addListener: (fn) => listeners.push(fn), removeListener: () => {} } } };
}

test('extension queues checkouts and bridge delivers only to the local dashboard, then acknowledges', async () => {
  const browser = extensionStorage();
  const sandbox = { browser, console };
  vm.runInNewContext(readFileSync(new URL('../../checkout-guard/core.js', import.meta.url), 'utf8'), sandbox);
  const guard = sandbox.CheckoutGuard;
  await guard.queuePurchase(purchase);
  const messages = [];
  const listeners = [];
  const window = { addEventListener: (_, fn) => listeners.push(fn), postMessage: (message) => messages.push(message) };
  window.top = window;
  const origin = 'http://127.0.0.1:5173';
  vm.runInNewContext(readFileSync(new URL('../../checkout-guard/sync.js', import.meta.url), 'utf8'), {
    CheckoutGuard: guard, window, location: { origin }, document: { querySelector: () => ({}) }, setInterval: () => {}, console,
  });
  assert.equal(messages.some((message) => message.type === 'purchase'), false);
  await listeners[0]({ source: window, origin, data: { source: 'credit-guard-dashboard', type: 'ready' } });
  const offered = messages.find((message) => message.type === 'purchase');
  assert.equal(offered.purchase.amount, 6999);
  assert.equal((await guard.pendingPurchases()).length, 1);
  const saved = receiveCheckout(memoryStorage(), null, offered.purchase);
  assert.equal(saved.result.transactions.length, 1);
  await listeners[0]({ source: window, origin, data: { source: 'credit-guard-dashboard', type: 'purchase-saved', id: purchase.id } });
  assert.equal((await guard.pendingPurchases()).length, 0);

  const blocked = [];
  const other = { addEventListener: () => blocked.push('listener'), postMessage: () => blocked.push('message') };
  other.top = other;
  vm.runInNewContext(readFileSync(new URL('../../checkout-guard/sync.js', import.meta.url), 'utf8'), {
    CheckoutGuard: guard, window: other, location: { origin: 'https://example.shop' }, console,
  });
  assert.equal(blocked.length, 0);
});
