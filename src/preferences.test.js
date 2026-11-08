import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseDisplayPreferences, effectiveDisplayPreferences, loadDisplayPreferences, saveDisplayPreferences } from './preferences.js';

const memory = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

test('display choices migrate existing settings and respect the system theme on first use', () => {
  assert.equal(loadDisplayPreferences(memory(), true).theme, 'dark');
  const saved = loadDisplayPreferences(memory({ 'credit-guard-theme': 'light', 'credit-guard-font': 'dyslexic', 'credit-guard-view': 'detailed' }), true);
  assert.equal(saved.theme, 'light');
  assert.equal(saved.font, 'dyslexic');
  assert.equal(saved.view, 'detailed');
  assert.equal(saved.advancedMode, false);
});

test('advanced choices persist; turning advanced mode off suspends rather than erases them', () => {
  const storage = memory();
  const preferences = normaliseDisplayPreferences({ advancedMode: true, textSize: 'extra-large', spacing: 'comfortable', reduceMotion: true });
  assert.equal(saveDisplayPreferences(storage, preferences), true);
  assert.deepEqual(loadDisplayPreferences(storage), preferences);
  const paused = { ...preferences, advancedMode: false };
  assert.equal(effectiveDisplayPreferences(paused).textSize, 'normal');
  assert.equal(effectiveDisplayPreferences(paused).spacing, 'standard');
  assert.equal(effectiveDisplayPreferences(paused).reduceMotion, false);
  assert.equal(paused.textSize, 'extra-large');
});

test('invalid stored values cannot inject styles or turn switches on with strings', () => {
  const safe = normaliseDisplayPreferences({ theme: 'url(bad)', font: '<script>', view: 'everything', advancedMode: 'true', textSize: 999, spacing: null, reduceMotion: 'false' });
  assert.deepEqual(safe, normaliseDisplayPreferences({}));
  assert.deepEqual(loadDisplayPreferences(memory({ 'credit-guard-personalisation-v1': '{broken' })), normaliseDisplayPreferences({}));
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
  assert.equal(loadDisplayPreferences(blocked).font, 'default');
  assert.equal(saveDisplayPreferences(blocked, safe), false);
});
