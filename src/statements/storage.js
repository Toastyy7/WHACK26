const key = 'credit-guard-statement-v1';

// Validate stored data before rendering it. Corrupt or old data must not break Home.
export function loadStatement(storage) {
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (saved?.version !== 1 || typeof saved.fileName !== 'string' || !Array.isArray(saved.result?.transactions)) return null;
    const valid = saved.result.transactions.every((row) =>
      typeof row.id === 'string' && typeof row.description === 'string' && typeof row.date === 'string' &&
      typeof row.category === 'string' && Number.isSafeInteger(row.amount) && row.amount >= 0 &&
      (row.isoDate === null || (typeof row.isoDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.isoDate))));
    return valid ? saved : null;
  } catch { return null; }
}

export function saveStatement(storage, statement) {
  if (statement) storage.setItem(key, JSON.stringify({ ...statement, version: 1 }));
  else storage.removeItem(key);
}
