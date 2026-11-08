// Each account keeps its own data in this browser: the existing storage keys get a
// per-account prefix. Guests use the original keys, so today's saved demo data still works.
// `base` is a function so blocked storage throws when used, inside the hooks' existing try/catch.
export function scopedStorage(base, userId) {
  const prefix = userId ? `credit-guard-user:${userId}:` : '';
  return {
    keyFor: (key) => prefix + key,
    getItem: (key) => base().getItem(prefix + key),
    setItem: (key, value) => base().setItem(prefix + key, value),
    removeItem: (key) => base().removeItem(prefix + key),
  };
}
