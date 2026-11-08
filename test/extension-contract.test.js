import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parsePoundsToPence, getGaugeState } from '../src/account.js';
import { formatMoney } from '../src/utils/format.js';
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

test('extension and dashboard show the same safe-to-spend number, colour and words', () => {
  const colour = { safe: 'green', warning: 'amber', danger: 'red' };
  const limit = 100000;
  const target = 30;
  for (const owed of [0, 20000, 23999, 24000, 28000, 30000, 30001, 34999, 90000]) {
    const dashboard = getGaugeState(owed, limit, target);
    // The extension receives exactly what the dashboard sends: safe limit and amount owed (pounds).
    const extension = guard.impact({ monthlyBudget: (dashboard.threshold / 100).toFixed(2), currentSpent: (owed / 100).toFixed(2) });
    assert.equal(extension.remaining, dashboard.safeToSpend, `remaining ${owed}`);
    assert.equal(colour[extension.zone], dashboard.zone, `zone ${owed}`);
    const words = dashboard.over ? `${formatMoney(dashboard.over)} over your safe limit` : dashboard.label;
    assert.equal(extension.label, words, `label ${owed}`);
  }
});
