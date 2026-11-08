import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { effectiveDisplayPreferences } from '../src/preferences.js';
import { getBalanceFigure } from '../src/balanceFigure.js';

function extension(values = {}) {
  const listeners = new Set();
  const context = vm.createContext({ browser: { storage: {
    local: {
      get: async () => ({ ...values }),
      set: async (data) => Object.assign(values, data),
    },
    onChanged: { addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) },
  } } });
  vm.runInContext(readFileSync(new URL('../checkout-guard/core.js', import.meta.url), 'utf8'), context);
  return { guard: context.CheckoutGuard, values, listeners };
}

test('website and extension apply exactly the same display preferences, including advanced off', () => {
  const { guard } = extension();
  for (const input of [null, {}, { theme: '<style>', font: 'bad', advancedMode: 'true', textSize: 999 },
    { theme: 'dark', font: 'dyslexic', view: 'detailed', advancedMode: true, textSize: 'extra-large', spacing: 'comfortable', reduceMotion: true },
    { advancedMode: false, textSize: 'large', spacing: 'comfortable', reduceMotion: true }]) {
    assert.equal(JSON.stringify(guard.displayPreferences(input)), JSON.stringify(effectiveDisplayPreferences(input)));
  }
});

test('chosen balance figures match across website and extension, including zero, over-limit and unknown card limit', () => {
  const { guard } = extension();
  for (const owed of [0, 28000, 30000, 30001, 100000, 100001]) {
    for (const cardLimit of [100000, null]) {
      for (const mode of ['safe-to-spend', 'card-remaining', 'owed', 'unknown']) {
        const values = { safeLimit: 30000, owed, cardLimit };
        assert.equal(JSON.stringify(guard.getBalanceFigure(mode, values)), JSON.stringify(getBalanceFigure(mode, values)));
      }
    }
  }
  assert.equal(getBalanceFigure('card-remaining', { safeLimit: 30000, owed: 28000, cardLimit: 100000 }).amount, 72000);
  assert.equal(getBalanceFigure('card-remaining', { safeLimit: 30000, owed: 100001, cardLimit: 100000 }).amount, 0);
  assert.equal(getBalanceFigure('owed', { safeLimit: 30000, owed: 28000 }).amount, 28000);
  assert.equal(getBalanceFigure('card-remaining', { safeLimit: 30000, owed: 28000 }).amount, null);
});

test('headline choice persists independently of Advanced Mode and old preferences default to safe to spend', async () => {
  const { guard } = extension();
  const preferences = effectiveDisplayPreferences({ balanceFigure: 'card-remaining', advancedMode: false });
  assert.equal(preferences.balanceFigure, 'card-remaining');
  await guard.setDisplayPreferences(preferences);
  assert.equal((await guard.getDisplayPreferences()).balanceFigure, 'card-remaining');
  assert.equal(guard.displayPreferences({ balanceFigure: '<style>' }).balanceFigure, 'safe-to-spend');
  const { balanceFigure, ...legacy } = preferences;
  await guard.setDisplayPreferences(legacy);
  assert.equal((await guard.getDisplayPreferences()).balanceFigure, 'safe-to-spend');
});

test('display choices survive budget resets, migrate the font, and reject malformed bridge payloads', async () => {
  const { guard, values } = extension({ 'checkoutGuard.font': 'dyslexic' });
  assert.equal((await guard.getDisplayPreferences()).font, 'dyslexic');
  const preferences = effectiveDisplayPreferences({ theme: 'dark', advancedMode: true, textSize: 'large', spacing: 'comfortable', reduceMotion: true });
  await guard.setDisplayPreferences(preferences);
  await guard.save(guard.defaults);
  await guard.clearApprovals();
  assert.equal(JSON.stringify(await guard.getDisplayPreferences()), JSON.stringify(preferences));
  assert.equal(await guard.getFont(), preferences.font);
  for (const bad of [null, 'dark', {}, { ...preferences, textSize: '900px' }, { ...preferences, reduceMotion: 'true' }, { ...preferences, balanceFigure: 'bad' }]) {
    await assert.rejects(guard.setDisplayPreferences(bad));
  }
  assert.equal(values.currentSpent, guard.defaults.currentSpent);
  assert.equal(JSON.stringify(await guard.getDisplayPreferences()), JSON.stringify(preferences));
});

test('display subscriptions update existing popups and ignore money or other storage areas', () => {
  const { guard, listeners } = extension();
  let count = 0;
  const stop = guard.subscribeDisplayPreferences(() => count++);
  const notify = [...listeners][0];
  notify({ monthlyBudget: {} }, 'local');
  notify({ 'checkoutGuard.preferences': {} }, 'sync');
  assert.equal(count, 0);
  notify({ 'checkoutGuard.preferences': {} }, 'local');
  notify({ 'checkoutGuard.font': {} }, 'local');
  assert.equal(count, 2);
  stop();
  assert.equal(listeners.size, 0);
});
