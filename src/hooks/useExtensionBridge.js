import { useEffect, useRef } from 'react';

const post = (message) => window.postMessage({ source: 'credit-guard-dashboard', ...message }, location.origin);

// Reset demo: the extension forgets approved shops so the pause shows again.
export const resetExtension = () => post({ type: 'reset' });

// The dashboard's only link to the CheckoutGuard extension (checkout-guard/sync.js).
// Messages never leave this window: both sides check the source window and origin.
// Extension → dashboard: purchases and paused checkouts, acknowledged only once saved.
// Dashboard → extension: a snapshot (integer pence) so both show the same budget and spend.
export default function useExtensionBridge({ monthlyBudget, currentSpent, receivePurchase, receiveCoolingItem }) {
  const snapshot = { type: 'snapshot', monthlyBudget, currentSpent: Math.max(0, currentSpent) };
  const latest = useRef();
  latest.current = { receivePurchase, receiveCoolingItem, snapshot };

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'checkout-guard-extension') return;
      const { type, purchase, item } = event.data;
      // The extension may load after React; it announces itself and we reply.
      if (type === 'bridge-ready') {
        post({ type: 'ready' });
        post(latest.current.snapshot);
      } else if (type === 'purchase' && latest.current.receivePurchase(purchase)) {
        post({ type: 'purchase-saved', id: purchase.id });
      } else if (type === 'cooling-item' && latest.current.receiveCoolingItem(item)) {
        post({ type: 'cooling-item-saved', id: item.id });
      }
    }
    window.addEventListener('message', onMessage);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Resend whenever the shared numbers change.
  useEffect(() => post(snapshot), [snapshot.monthlyBudget, snapshot.currentSpent]);
}
