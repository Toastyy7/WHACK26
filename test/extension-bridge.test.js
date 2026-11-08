import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the hook's external messages and timers without a browser or network.
function bridgeHarness() {
  const messages = [];
  const listeners = new Map();
  const intervals = [];
  const cleanups = [];
  const states = [];
  let now = 0;
  const window = {
    postMessage: (message) => { messages.push(message); },
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type),
  };
  const source = readFileSync(new URL('../src/hooks/useExtensionBridge.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export const resetExtension', 'const resetExtension')
    .replace('export default function useExtensionBridge', 'function useExtensionBridge');
  const context = {
    window, location: { origin: 'http://localhost:5173' }, Date: { now: () => now },
    useRef: (value) => ({ current: value }),
    useState: (value) => { states.push(value); return [value, (next) => states.push(next)]; },
    useEffect: (effect) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
    setInterval: (callback) => { intervals.push(callback); return intervals.length; },
    clearInterval: () => {},
  };
  vm.runInNewContext(`${source}\nuseExtensionBridge({monthlyBudget:30000,currentSpent:28000,receivePurchase:()=>true,receiveCoolingItem:()=>true});`, context);
  function receive(data, origin = context.location.origin, sender = window) {
    listeners.get('message')?.({ source: sender, origin, data: { source: 'checkout-guard-extension', ...data } });
  }
  return { messages, states, intervals, receive, advance: (milliseconds) => { now += milliseconds; }, close: () => cleanups.forEach((cleanup) => cleanup()) };
}

test('missed startup messages are retried without editing demo values or reloading', () => {
  const bridge = bridgeHarness();
  const initialReady = bridge.messages.filter((message) => message.type === 'ready').length;
  assert.ok(bridge.intervals.length > 0, 'The bridge must retry when startup messages are missed');
  bridge.intervals.forEach((tick) => tick());
  assert.ok(bridge.messages.filter((message) => message.type === 'ready').length > initialReady);
  assert.ok(bridge.messages.filter((message) => message.type === 'snapshot').length >= 2);
  bridge.close();
});

test('connection is confirmed only when this origin acknowledges the current money values', () => {
  const bridge = bridgeHarness();
  bridge.receive({ type: 'snapshot-applied', monthlyBudget: 30000, currentSpent: 28000 }, 'https://shop.example');
  bridge.receive({ type: 'snapshot-applied', monthlyBudget: 1, currentSpent: 2 });
  assert.ok(!bridge.states.includes('connected'));
  bridge.receive({ type: 'snapshot-applied', monthlyBudget: 30000, currentSpent: 28000 });
  assert.equal(bridge.states.at(-1), 'connected');
  bridge.close();
});


test('connection loss becomes visible and a later acknowledgement restores it', () => {
  const bridge = bridgeHarness();
  bridge.receive({ type: 'snapshot-applied', monthlyBudget: 30000, currentSpent: 28000 });
  bridge.advance(16000);
  bridge.intervals.forEach((tick) => tick());
  assert.equal(bridge.states.at(-1), 'disconnected');
  bridge.receive({ type: 'snapshot-applied', monthlyBudget: 30000, currentSpent: 28000 });
  assert.equal(bridge.states.at(-1), 'connected');
  bridge.close();
});
