import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { effectiveDisplayPreferences } from '../src/preferences.js';

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

test('display choices survive budget resets, migrate the font, and reject malformed bridge payloads', async () => {
  const { guard, values } = extension({ 'checkoutGuard.font': 'dyslexic' });
  assert.equal((await guard.getDisplayPreferences()).font, 'dyslexic');
  const preferences = effectiveDisplayPreferences({ theme: 'dark', advancedMode: true, textSize: 'large', spacing: 'comfortable', reduceMotion: true });
  await guard.setDisplayPreferences(preferences);
  await guard.save(guard.defaults);
  await guard.clearApprovals();
  assert.equal(JSON.stringify(await guard.getDisplayPreferences()), JSON.stringify(preferences));
  assert.equal(await guard.getFont(), preferences.font);
  for (const bad of [null, 'dark', {}, { ...preferences, textSize: '900px' }, { ...preferences, reduceMotion: 'true' }]) {
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
