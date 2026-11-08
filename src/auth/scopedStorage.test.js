import test from 'node:test';
import assert from 'node:assert/strict';
import { scopedStorage } from './scopedStorage.js';
import { loadCoolingQueue, saveCoolingQueue, createInitialCoolingQueue } from '../coolingQueue.js';

function memory() {
  const data = new Map();
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}

test('each account gets its own keys; guests keep the original keys', () => {
  const base = memory();
  const alex = scopedStorage(() => base, 'user-a');
  const sam = scopedStorage(() => base, 'user-b');
  const guest = scopedStorage(() => base, null);
  alex.setItem('credit-guard-cooling-v1', 'A');
  sam.setItem('credit-guard-cooling-v1', 'B');
  guest.setItem('credit-guard-cooling-v1', 'G');
  assert.equal(alex.getItem('credit-guard-cooling-v1'), 'A');
  assert.equal(sam.getItem('credit-guard-cooling-v1'), 'B');
  assert.equal(base.getItem('credit-guard-cooling-v1'), 'G');  // today's saved demo data stays the guest's
  assert.equal(alex.keyFor('credit-guard-cooling-v1'), 'credit-guard-user:user-a:credit-guard-cooling-v1');
  alex.removeItem('credit-guard-cooling-v1');
  assert.equal(sam.getItem('credit-guard-cooling-v1'), 'B');
});

test('existing storage code works unchanged through it', () => {
  const base = memory();
  const alex = scopedStorage(() => base, 'user-a');
  const queue = { ...createInitialCoolingQueue(0), savings: 6999 };
  saveCoolingQueue(alex, queue);
  assert.deepEqual(loadCoolingQueue(alex), queue);
  assert.equal(loadCoolingQueue(scopedStorage(() => base, 'user-b')), null);
});

test('blocked storage still throws at use time, where the hooks already catch it', () => {
  const blocked = scopedStorage(() => { throw new Error('SecurityError'); }, 'user-a');
  assert.throws(() => blocked.getItem('x'), /SecurityError/);
});
