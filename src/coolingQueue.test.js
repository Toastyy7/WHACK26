import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCoolingItem, createInitialCoolingQueue, dismissCoolingItem, loadCoolingQueue, saveCoolingQueue,
} from './coolingQueue.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

test('reflection items deduplicate, persist, and accumulate savings when dismissed', () => {
  const storage = memoryStorage();
  const initial = createInitialCoolingQueue(1000000);
  const item = { version: 1, id: 'checkout-2', title: 'Fitness tracker', store: 'shop.example', amount: 5499, savedAt: 1000000, expiresAt: 2800000 };
  const added = addCoolingItem(addCoolingItem(initial, item), item);
  assert.equal(added.items.length, 2);
  saveCoolingQueue(storage, added);
  const saved = dismissCoolingItem(loadCoolingQueue(storage), item.id);
  assert.equal(saved.items.length, 1);
  assert.equal(saved.savings, 5499);
});
