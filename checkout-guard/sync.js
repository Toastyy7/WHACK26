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
  const offered = new Set();

  async function deliver() {
    if (!ready || !document.querySelector('meta[name="checkout-guard-dashboard"][content="v1"]')) return;
    try {
      for (const purchase of await guard.pendingPurchases()) {
        offered.add(purchase.id);
        window.postMessage({ source: 'checkout-guard-extension', type: 'purchase', purchase }, location.origin);
      }
    } catch (error) { console.warn('[CheckoutGuard] Sync pending:', error.message); }
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'credit-guard-dashboard') return;
    if (event.data.type === 'ready') {
      ready = true;
      await deliver();
    } else if (event.data.type === 'purchase-saved' && offered.has(event.data.id)) {
      try {
        await guard.acknowledgePurchase(event.data.id);
        offered.delete(event.data.id);
      } catch (error) { console.warn('[CheckoutGuard] Acknowledgement pending:', error.message); }
    }
  });
  guard.subscribePurchases(deliver);
  // Handshake works whether the extension or React starts listening first.
  window.postMessage({ source: 'checkout-guard-extension', type: 'bridge-ready' }, location.origin);
  setInterval(deliver, 5000);
})();
