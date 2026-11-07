const storageKey = 'credit-guard-cooling-v1';

export function validCoolingItem(item) {
  return item?.version === 1 && typeof item.id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(item.id) &&
    typeof item.title === 'string' && item.title.length > 0 && item.title.length <= 160 &&
    typeof item.store === 'string' && item.store.length > 0 && item.store.length <= 100 &&
    Number.isSafeInteger(item.amount) && item.amount > 0 && item.amount <= 999999999 &&
    Number.isSafeInteger(item.savedAt) && Number.isSafeInteger(item.expiresAt) && item.expiresAt > item.savedAt;
}

export function createInitialCoolingQueue(now = Date.now()) {
  return {
    items: [{
      version: 1,
      id: 'cool-001',
      title: 'Wireless ANC Headphones',
      store: 'Apex Retail',
      amount: 6999,
      savedAt: now - 10 * 60 * 1000,
      expiresAt: now + 20 * 60 * 1000,
    }],
    savings: 0,
  };
}

export function addCoolingItem(queue, item) {
  if (!validCoolingItem(item)) throw new Error('Invalid reflection queue item.');
  return { ...queue, items: [item, ...queue.items.filter((entry) => entry.id !== item.id)].slice(0, 50) };
}

export function dismissCoolingItem(queue, itemId) {
  const target = queue.items.find((item) => item.id === itemId);
  if (!target) return queue;
  return {
    items: queue.items.filter((item) => item.id !== itemId),
    savings: queue.savings + target.amount,
  };
}

export function loadCoolingQueue(storage) {
  const value = JSON.parse(storage.getItem(storageKey) || 'null');
  if (value === null) return null;
  if (!Array.isArray(value.items) || !value.items.every(validCoolingItem) ||
      !Number.isSafeInteger(value.savings) || value.savings < 0) throw new Error('Saved reflection queue is invalid.');
  return value;
}

export function saveCoolingQueue(storage, queue) {
  if (queue === null) storage.removeItem(storageKey);
  else storage.setItem(storageKey, JSON.stringify(queue));
}

export { storageKey as coolingStorageKey };
