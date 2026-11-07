import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../checkout-guard/core.js', import.meta.url), 'utf8');
function core(globals = {}) {
  const context = vm.createContext(globals);
  vm.runInContext(source, context);
  return context.CheckoutGuard;
}

test('GBP amounts use pence, recognise grouped totals and reject other currencies', () => {
  const guard = core();
  for (const [text, expected] of [
    ['£1,234.56', 123456], ['Total: GBP 69.99', 6999], ['69.99 GBP', 6999],
    ['£0.00', 0], ['€69.99', null], ['$69.99', null], ['£1,23.45', null],
    ['£12.345', null], ['£-20.00', null], ['£10 + £20', null], ['', null],
  ]) assert.equal(guard.parseGbp(text), expected, text);
  assert.equal(guard.pence('.50'), 50);
  assert.equal(guard.pence('12.'), 1200);
  assert.equal(guard.pence(' 12.05 '), 1205);
  for (const value of [NaN, Infinity, -1, '', '1e3', '12.005', '10000000']) assert.equal(guard.pence(value), null);
});

test('budget maths retains the true percentage and exact penny boundaries', () => {
  const guard = core();
  for (const [spend, purchase, percentage, zone, remaining] of [
    [120, 0, 40, 'safe', 18000],
    [239.99, 0, 23999 / 300, 'safe', 6001],
    [240, 0, 80, 'warning', 6000],
    [300, 0, 100, 'warning', 0],
    [300, 1, 30001 / 300, 'danger', 0],
    [360, 0, 120, 'danger', 0],
  ]) {
    const result = guard.impact({ ...guard.defaults, currentSpent: spend }, purchase);
    assert.equal(result.percentage, percentage);
    assert.equal(result.zone, zone);
    assert.equal(result.remaining, remaining);
    assert.equal(result.width, Math.min(100, percentage));
  }
  const tiny = guard.impact({ ...guard.defaults, monthlyBudget: .30, currentSpent: .10 }, 20);
  assert.equal(tiny.percentage, 100);
  assert.equal(tiny.remaining, 0);
});

test('corrupt stored settings get safe defaults; saving invalid settings is rejected', async () => {
  const guard = core();
  const result = guard.normalise({ isEnabled: 'false', monthlyBudget: -1, currentSpent: NaN, cooldownSeconds: '<img>' });
  assert.equal(JSON.stringify(result), JSON.stringify(guard.defaults));
  for (const change of [{ monthlyBudget: 0 }, { currentSpent: -1 }, { cooldownSeconds: 0 }, { cooldownSeconds: 301 }]) {
    await assert.rejects(guard.save({ ...guard.defaults, ...change }), /Invalid budget settings/);
  }
  await assert.rejects(guard.load(), /unavailable/);
});

test('Firefox promise storage loads and saves without passing callbacks', async () => {
  let values = { monthlyBudget: 200, currentSpent: 180 };
  const guard = core({ browser: { storage: { local: {
    get: async (defaults) => ({ ...defaults, ...values }),
    set: async (data) => { values = { ...values, ...data }; },
  } } } });
  assert.equal((await guard.load()).monthlyBudget, 200);
  await guard.setEnabled(false);
  assert.equal(values.isEnabled, false);
  assert.equal(values.monthlyBudget, 200);
  await guard.save({ ...guard.defaults, currentSpent: 360 });
  assert.equal((await guard.load()).currentSpent, 360);
});

test('Chrome callbacks report storage failures instead of claiming a save succeeded', async () => {
  const chrome = { runtime: {}, storage: { local: {
    get: (defaults, done) => done({ ...defaults, currentSpent: 240 }),
    set: (_data, done) => {
      chrome.runtime.lastError = { message: 'Disk full' };
      done();
      delete chrome.runtime.lastError;
    },
  } } };
  const guard = core({ chrome });
  assert.equal((await guard.load()).currentSpent, 240);
  await assert.rejects(guard.save(guard.defaults), /Disk full/);
});

test('settings subscription filters unrelated changes and can unsubscribe', () => {
  let listener;
  let notified = 0;
  const guard = core({ browser: { storage: {
    local: {},
    onChanged: { addListener: (fn) => { listener = fn; }, removeListener: (fn) => { assert.equal(fn, listener); listener = null; } },
  } } });
  const unsubscribe = guard.subscribe(() => notified++);
  listener({ monthlyBudget: {} }, 'sync');
  listener({ unrelated: {} }, 'local');
  assert.equal(notified, 0);
  listener({ monthlyBudget: {} }, 'local');
  listener({ isEnabled: {} }, 'local');
  assert.equal(notified, 2);
  unsubscribe();
  assert.equal(listener, null);
});
