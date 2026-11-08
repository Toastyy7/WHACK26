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
      // Same words as the dashboard (src/account.js getGaugeState); a contract test checks this.
      label: zone === 'danger' ? `${money(projected - budget)} over your safe limit`
        : zone === 'warning' ? 'Close to your safe limit' : 'Within your safe limit',
    };
  }

  // Display-only amounts, in integer pence. The safe-limit gauge is independent.
  const balanceFigures = [
    { value: 'safe-to-spend', label: 'Safe to spend', description: 'Your chosen safe limit minus what you owe.' },
    { value: 'card-remaining', label: 'Card limit remaining', description: 'Your full card limit minus what you owe. Your safe-to-spend amount can be lower.' },
    { value: 'owed', label: 'What you owe', description: 'The amount currently owed on your card.' },
  ];

  function getBalanceFigure(mode, { safeLimit, owed, cardLimit }) {
    const choice = balanceFigures.find((item) => item.value === mode) ?? balanceFigures[0];
    const balance = Math.max(0, owed);
    const amount = choice.value === 'owed' ? balance : choice.value === 'card-remaining'
      ? Number.isSafeInteger(cardLimit) && cardLimit > 0 ? Math.max(0, cardLimit - balance) : null
      : Math.max(0, safeLimit - balance);
    return { label: choice.label, description: choice.description, amount };
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

  const cardLimitKey = 'checkoutGuard.cardLimit';
  const validCardLimit = (value) => Number.isSafeInteger(value) && value > 0 && value <= 999999999;

  function subscribe(listener) {
    const event = api()?.extension.storage.onChanged;
    if (!event) return () => {};
    const handle = (changes, area) => {
      if (area === 'local' && (cardLimitKey in changes || Object.keys(defaults).some((key) => key in changes))) listener();
    };
    event.addListener(handle);
    return () => event.removeListener(handle);
  }


  const purchasePrefix = 'checkoutGuard.purchase.';
  function validPurchase(purchase) {
    return purchase?.version === 1 && typeof purchase.id === 'string' &&
      /^[a-zA-Z0-9-]{1,100}$/.test(purchase.id) && Number.isSafeInteger(purchase.amount) &&
      purchase.amount > 0 && purchase.amount <= 999999999 && purchase.currency === 'GBP' &&
      typeof purchase.merchant === 'string' && purchase.merchant.length > 0 && purchase.merchant.length <= 200 &&
      typeof purchase.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(purchase.date);
  }

  async function queuePurchase(purchase) {
    if (!validPurchase(purchase)) throw new Error('Enter a valid GBP purchase amount before continuing.');
    // A separate key per event avoids losing simultaneous checkouts in different tabs.
    await storage('set', { [purchasePrefix + purchase.id]: purchase });
  }

  async function pendingPurchases() {
    const data = await storage('get', null);
    return Object.entries(data).filter(([key, value]) =>
      key === purchasePrefix + value?.id && validPurchase(value)).map(([, value]) => value);
  }

  function subscribePurchases(listener) {
    const event = api()?.extension.storage.onChanged;
    if (!event) return () => {};
    const handle = (changes, area) => {
      if (area === 'local' && Object.keys(changes).some((key) => key.startsWith(purchasePrefix))) listener();
    };
    event.addListener(handle);
    return () => event.removeListener(handle);
  }

  const coolingPrefix = 'checkoutGuard.cooling.';
  function validCoolingItem(item) {
    return item?.version === 1 && typeof item.id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(item.id) &&
      Number.isSafeInteger(item.amount) && item.amount > 0 && item.amount <= 999999999 &&
      typeof item.title === 'string' && item.title.length > 0 && item.title.length <= 160 &&
      typeof item.store === 'string' && item.store.length > 0 && item.store.length <= 100 &&
      Number.isSafeInteger(item.savedAt) && Number.isSafeInteger(item.expiresAt) && item.expiresAt > item.savedAt;
  }

  async function queueCoolingItem(item) {
    if (!validCoolingItem(item)) throw new Error('Enter a valid GBP amount before leaving checkout.');
    await storage('set', { [coolingPrefix + item.id]: item });
  }

  async function pendingCoolingItems() {
    const data = await storage('get', null);
    return Object.entries(data).filter(([key, value]) =>
      key === coolingPrefix + value?.id && validCoolingItem(value)).map(([, value]) => value);
  }

  function subscribeCoolingItems(listener) {
    const event = api()?.extension.storage.onChanged;
    if (!event) return () => {};
    const handle = (changes, area) => {
      if (area === 'local' && Object.keys(changes).some((key) => key.startsWith(coolingPrefix))) listener();
    };
    event.addListener(handle);
    return () => event.removeListener(handle);
  }

  // Settings store pounds; keep maths in integer pence and convert once.
  async function updateSettings(change, extra = {}) {
    const current = normalise(await storage('get', defaults));
    await storage('set', { ...normalise({ ...current, ...change }), ...extra });
  }

  async function recordSpend(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid purchase amount.');
    const current = normalise(await storage('get', defaults));
    await updateSettings({ currentSpent: ((pence(current.currentSpent) + amount) / 100).toFixed(2) });
  }

  // The open dashboard is the source of truth: its target becomes the budget and
  // this month's dashboard spending becomes the extension's spend.
  async function applySnapshot(snapshot) {
    const { monthlyBudget, currentSpent, cardLimit } = snapshot ?? {};
    if (!Number.isSafeInteger(monthlyBudget) || monthlyBudget <= 0 ||
        !Number.isSafeInteger(currentSpent) || currentSpent < 0 ||
        (cardLimit !== undefined && !validCardLimit(cardLimit))) throw new Error('Invalid dashboard snapshot.');
    await updateSettings({ monthlyBudget: (monthlyBudget / 100).toFixed(2), currentSpent: (currentSpent / 100).toFixed(2) }, { [cardLimitKey]: cardLimit ?? null });
  }

  // Once someone continues past (or closes) the pause, later steps of the same
  // shop's checkout must not pause again or record the order twice.
  const approvalPrefix = 'checkoutGuard.approved.';
  const approvalMs = 30 * 60 * 1000;
  const approve = (host, now = Date.now()) => storage('set', { [approvalPrefix + host]: now + approvalMs });
  // Font follows the dashboard's setting. A separate key, so saving budgets never resets it.
  const fontKey = 'checkoutGuard.font';
  const fonts = ['default', 'dyslexic'];
  async function getFont() {
    const font = (await storage('get', fontKey))?.[fontKey];
    return fonts.includes(font) ? font : 'default';
  }
  async function setFont(font) {
    if (!fonts.includes(font)) throw new Error('Unknown font.');
    await storage('set', { [fontKey]: font });
  }
  function subscribeFont(listener) {
    const event = api()?.extension.storage.onChanged;
    if (!event) return () => {};
    const handle = (changes, area) => { if (area === 'local' && fontKey in changes) listener(); };
    event.addListener(handle);
    return () => event.removeListener(handle);
  }
  // Same allowlist as src/preferences.js; guarded by test/display-contract.test.js.
  // Kept apart from money, so Reset demo never resets accessibility choices.
  const preferencesKey = 'checkoutGuard.preferences';
  function displayPreferences(value) {
    const input = value && typeof value === 'object' ? value : {};
    const advancedMode = input.advancedMode === true;
    return {
      theme: ['light', 'dark'].includes(input.theme) ? input.theme : 'light',
      font: fonts.includes(input.font) ? input.font : 'default',
      view: ['simple', 'detailed'].includes(input.view) ? input.view : 'simple',
      advancedMode,
      textSize: advancedMode && ['large', 'extra-large'].includes(input.textSize) ? input.textSize : 'normal',
      spacing: advancedMode && input.spacing === 'comfortable' ? 'comfortable' : 'standard',
      reduceMotion: advancedMode && input.reduceMotion === true,
      balanceFigure: ['safe-to-spend', 'card-remaining', 'owed'].includes(input.balanceFigure) ? input.balanceFigure : 'safe-to-spend',
    };
  }
  async function getDisplayPreferences() {
    const data = await storage('get', [preferencesKey, fontKey]);
    const preferences = displayPreferences(data?.[preferencesKey]);
    if (fonts.includes(data?.[fontKey])) preferences.font = data[fontKey];
    return preferences;
  }
  async function setDisplayPreferences(value) {
    if (!value || !['light', 'dark'].includes(value.theme) || !fonts.includes(value.font) ||
        !['simple', 'detailed'].includes(value.view) || typeof value.advancedMode !== 'boolean' ||
        !['normal', 'large', 'extra-large'].includes(value.textSize) ||
        !['standard', 'comfortable'].includes(value.spacing) || typeof value.reduceMotion !== 'boolean' ||
        (value.balanceFigure !== undefined && !['safe-to-spend', 'card-remaining', 'owed'].includes(value.balanceFigure))) {
      throw new Error('Invalid display preferences.');
    }
    const preferences = displayPreferences(value);
    await storage('set', { [preferencesKey]: preferences, [fontKey]: preferences.font });
  }
  function subscribeDisplayPreferences(listener) {
    const event = api()?.extension.storage.onChanged;
    if (!event) return () => {};
    const handle = (changes, area) => {
      if (area === 'local' && (preferencesKey in changes || fontKey in changes)) listener();
    };
    event.addListener(handle);
    return () => event.removeListener(handle);
  }
  function applyDisplayPreferences(element, value) {
    for (const [key, choice] of Object.entries(displayPreferences(value))) element.dataset[key] = String(choice);
  }
  // Extension files (fonts) as URLs usable from content scripts.
  const fileUrl = (path) => api()?.extension.runtime?.getURL?.(path) ?? null;

  // Reset demo (dashboard) and Reset (popup) make every shop pause again.
  async function clearApprovals() {
    const keys = Object.keys(await storage('get', null)).filter((key) => key.startsWith(approvalPrefix));
    for (const key of keys) await storage('remove', key);
  }
  async function isApproved(host, now = Date.now()) {
    const until = (await storage('get', approvalPrefix + host))?.[approvalPrefix + host];
    return Number.isSafeInteger(until) && until > now;
  }

  globalThis.CheckoutGuard = Object.freeze({
    getBalanceFigure, displayPreferences, getDisplayPreferences, setDisplayPreferences, subscribeDisplayPreferences, applyDisplayPreferences,
    recordSpend, applySnapshot, approve, isApproved, clearApprovals, getFont, setFont, subscribeFont, fileUrl,
    queuePurchase, pendingPurchases, subscribePurchases, validPurchase,
    acknowledgePurchase: (id) => storage('remove', purchasePrefix + id),
    queueCoolingItem, pendingCoolingItems, subscribeCoolingItems, validCoolingItem,
    acknowledgeCoolingItem: (id) => storage('remove', coolingPrefix + id),
    defaults, pence, parseGbp, normalise, validSettings, money, impact,
    available: () => api() !== null,
    load: async () => {
      const data = await storage('get', { ...defaults, [cardLimitKey]: null });
      return { ...normalise(data), cardLimit: validCardLimit(data?.[cardLimitKey]) ? data[cardLimitKey] : null };
    },
    save: async (settings) => {
      if (!validSettings(settings)) throw new Error('Invalid budget settings.');
      await storage('set', normalise(settings));
    },
    setEnabled: (isEnabled) => storage('set', { isEnabled: Boolean(isEnabled) }),
    subscribe,
  });
})();
