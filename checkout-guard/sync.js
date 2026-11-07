/* Bridge only to explicitly allowed local dashboard origins, never to shopping sites. */
(() => {
  const origins = new Set([
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:4173', 'http://127.0.0.1:4173',
    'http://localhost:3000', 'http://127.0.0.1:3000',
  ]);
  const guard = globalThis.CheckoutGuard;
  if (!guard?.available() || !origins.has(location.origin) || window.top !== window) return;
  let ready = false;
  const offeredPurchases = new Set();
  const offeredCooling = new Set();

  async function deliver() {
    if (!ready || !document.querySelector('meta[name="checkout-guard-dashboard"][content="v1"]')) return;
    try {
      for (const purchase of await guard.pendingPurchases()) {
        offeredPurchases.add(purchase.id);
        window.postMessage({ source: 'checkout-guard-extension', type: 'purchase', purchase }, location.origin);
      }
      for (const item of await guard.pendingCoolingItems()) {
        offeredCooling.add(item.id);
        window.postMessage({ source: 'checkout-guard-extension', type: 'cooling-item', item }, location.origin);
      }
    } catch (error) { console.warn('[CheckoutGuard] Sync pending:', error.message); }
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'credit-guard-dashboard') return;
    if (event.data.type === 'ready') {
      ready = true;
      await deliver();
    } else if (event.data.type === 'purchase-saved' && offeredPurchases.has(event.data.id)) {
      try {
        await guard.acknowledgePurchase(event.data.id);
        offeredPurchases.delete(event.data.id);
      } catch (error) { console.warn('[CheckoutGuard] Acknowledgement pending:', error.message); }
    } else if (event.data.type === 'cooling-item-saved' && offeredCooling.has(event.data.id)) {
      try {
        await guard.acknowledgeCoolingItem(event.data.id);
        offeredCooling.delete(event.data.id);
      } catch (error) { console.warn('[CheckoutGuard] Reflection queue acknowledgement pending:', error.message); }
    }
  });
  guard.subscribePurchases(deliver);
  guard.subscribeCoolingItems(deliver);
  // Handshake works whether the extension or React starts listening first.
  window.postMessage({ source: 'checkout-guard-extension', type: 'bridge-ready' }, location.origin);
  setInterval(deliver, 5000);
})();
