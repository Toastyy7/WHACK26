import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parsePoundsToPence } from '../src/account.js';
import { validCoolingItem } from '../src/coolingQueue.js';
import { checkoutTransaction } from '../src/statements/checkoutSync.js';

// The extension has no build step, so it cannot import from src/. These checks are
// duplicated on purpose; this test fails as soon as the two copies disagree.
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../checkout-guard/core.js', import.meta.url), 'utf8'), context);
const guard = context.CheckoutGuard;

test('extension and dashboard parse pounds identically', () => {
  for (const text of ['0', '12', '12.5', '12.05', '.50', '12.', ' 7.10 ', '1234567', '12345678', '12.005', '-1', '1e3', '', 'abc']) {
    assert.equal(guard.pence(text), parsePoundsToPence(text), JSON.stringify(text));
  }
});

test('extension and dashboard accept the same reflection queue items', () => {
  const good = { version: 1, id: 'abc-1', title: 'Headphones', store: 'shop.example', amount: 6999, savedAt: 1, expiresAt: 2 };
  for (const item of [good, { ...good, amount: 0 }, { ...good, id: 'bad id' }, { ...good, title: '' },
    { ...good, store: 'x'.repeat(101) }, { ...good, expiresAt: 1 }, { ...good, version: 2 }, null]) {
    assert.equal(guard.validCoolingItem(item), validCoolingItem(item), JSON.stringify(item));
  }
});

test('every purchase the extension queues is one the dashboard accepts, and vice versa', () => {
  const good = { version: 1, id: 'p-1', amount: 6999, currency: 'GBP', merchant: 'shop.example', date: '2026-11-08' };
  for (const purchase of [good, { ...good, amount: 0 }, { ...good, currency: 'USD' }, { ...good, id: 'x y' },
    { ...good, amount: 1.5 }, { ...good, version: 2 }]) {
    let dashboard = true;
    try { checkoutTransaction(purchase); } catch { dashboard = false; }
    assert.equal(guard.validPurchase(purchase), dashboard, JSON.stringify(purchase));
  }
});
