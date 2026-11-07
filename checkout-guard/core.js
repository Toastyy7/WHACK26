/* Shared by the popup and content script; no build step or network access. */
(() => {
  const defaults = Object.freeze({
    isEnabled: true,
    monthlyBudget: 300,
    currentSpent: 120,
    cooldownSeconds: 15,
  });

  function pence(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const text = String(value).trim().replace(/^\./, '0.');
    if (!/^\d{1,7}(?:\.\d{0,2})?$/.test(text)) return null;
    const [pounds, fraction = ''] = text.split('.');
    return Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
  }

  // Only GBP is comparable to a GBP budget. Never relabel dollars or euros.
  function parseGbp(text) {
    const matches = [...text.matchAll(/(?:£|\bGBP)\s*([-\d.,]+)|([-]?\d[\d.,]*)\s*GBP\b/gi)];
    if (matches.length !== 1) return null;
    const amount = matches[0][1] ?? matches[0][2];
    if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(amount)) return null;
    return pence(amount.replaceAll(',', ''));
  }

  function validSettings(data) {
    return typeof data?.isEnabled === 'boolean' &&
      pence(data.monthlyBudget) > 0 && pence(data.currentSpent) !== null &&
      Number.isInteger(data.cooldownSeconds) && data.cooldownSeconds >= 1 && data.cooldownSeconds <= 300;
  }

  function normalise(data = {}) {
    return {
      isEnabled: typeof data.isEnabled === 'boolean' ? data.isEnabled : defaults.isEnabled,
      monthlyBudget: pence(data.monthlyBudget) > 0 ? pence(data.monthlyBudget) / 100 : defaults.monthlyBudget,
      currentSpent: pence(data.currentSpent) !== null ? pence(data.currentSpent) / 100 : defaults.currentSpent,
      cooldownSeconds: Number.isInteger(data.cooldownSeconds) && data.cooldownSeconds >= 1 && data.cooldownSeconds <= 300
        ? data.cooldownSeconds : defaults.cooldownSeconds,
    };
  }

  const money = (amount) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
  }).format(amount / 100);
  const percent = (amount) => new Intl.NumberFormat('en-GB', {
    maximumFractionDigits: 2,
  }).format(amount) + '%';

  function impact(settings, purchase = 0) {
    const budget = pence(settings.monthlyBudget);
    const spent = pence(settings.currentSpent);
    const projected = spent + purchase;
    const percentage = projected * 100 / budget;
    const zone = projected > budget ? 'danger' : percentage >= 80 ? 'warning' : 'safe';
    return {
      projected, percentage, zone,
      width: Math.min(100, Math.max(0, percentage)),
      remaining: Math.max(0, budget - projected),
      label: zone === 'danger' ? `${money(projected - budget)} over your budget.`
        : zone === 'warning' ? 'Approaching spending limit.' : 'Within your budget.',
    };
  }

  function api() {
    if (globalThis.browser?.storage?.local) return { extension: globalThis.browser, promises: true };
    if (globalThis.chrome?.storage?.local) return { extension: globalThis.chrome, promises: false };
    return null;
  }

  async function storage(method, value) {
    const selected = api();
    if (!selected) throw new Error('Extension storage is unavailable.');
    const { extension, promises } = selected;
    if (promises) return extension.storage.local[method](value);
    return new Promise((resolve, reject) => {
      extension.storage.local[method](value, (result) => {
        const error = extension.runtime?.lastError;
        if (error) reject(new Error(error.message || 'Storage failed.'));
        else resolve(result);
      });
    });
  }

  function subscribe(listener) {
    const event = api()?.extension.storage.onChanged;
    if (!event) return () => {};
    const handle = (changes, area) => {
      if (area === 'local' && Object.keys(defaults).some((key) => key in changes)) listener();
    };
    event.addListener(handle);
    return () => event.removeListener(handle);
  }

  globalThis.CheckoutGuard = Object.freeze({
    defaults, pence, parseGbp, normalise, validSettings, money, percent, impact,
    available: () => api() !== null,
    load: async () => normalise(await storage('get', defaults)),
    save: async (settings) => {
      if (!validSettings(settings)) throw new Error('Invalid budget settings.');
      await storage('set', normalise(settings));
    },
    setEnabled: (isEnabled) => storage('set', { isEnabled: Boolean(isEnabled) }),
    subscribe,
  });
})();
