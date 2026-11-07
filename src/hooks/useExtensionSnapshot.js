import { useEffect } from 'react';

// Send the dashboard's numbers (integer pence) to the CheckoutGuard extension so
// both show one budget. checkout-guard/sync.js receives them; without it, nothing listens.
export default function useExtensionSnapshot(monthlyBudget, currentSpent) {
  useEffect(() => {
    const send = () => window.postMessage({
      source: 'credit-guard-dashboard', type: 'snapshot', monthlyBudget, currentSpent: Math.max(0, currentSpent),
    }, location.origin);
    // The extension may load after React; it announces itself with bridge-ready.
    function onMessage(event) {
      if (event.source === window && event.data?.source === 'checkout-guard-extension' &&
          event.data.type === 'bridge-ready') send();
    }
    window.addEventListener('message', onMessage);
    send();
    return () => window.removeEventListener('message', onMessage);
  }, [monthlyBudget, currentSpent]);
}
