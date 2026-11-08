import { useEffect, useRef, useState } from 'react';

const post = (message) => window.postMessage({ source: 'credit-guard-dashboard', ...message }, location.origin);

// Reset demo: the extension forgets approved shops so the pause shows again.
export const resetExtension = () => post({ type: 'reset' });

// The dashboard's only link to the CheckoutGuard extension (checkout-guard/sync.js).
// Messages never leave this window: both sides check the source window and origin.
// Extension → dashboard: purchases and paused checkouts, acknowledged only once saved.
// Dashboard → extension: a snapshot (integer pence) so both show the same budget and spend,
// and display preferences so the toolbar and checkout popups match the dashboard.
export default function useExtensionBridge({ monthlyBudget, currentSpent, receivePurchase, receiveCoolingItem, font = 'default', displayPreferences, cardLimit }) {
  const snapshot = { type: 'snapshot', monthlyBudget, currentSpent: Math.max(0, currentSpent), cardLimit };
  const latest = useRef();
  const preferences = { type: 'preferences', font, display: displayPreferences };
  const [connection, setConnection] = useState('connecting');
  const lastConfirmed = useRef(Date.now());
  latest.current = { receivePurchase, receiveCoolingItem, snapshot, preferences };

  useEffect(() => {
    function announce() {
      post({ type: 'ready' });
      post(latest.current.snapshot);
      post(latest.current.preferences);
    }
    function onMessage(event) {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'checkout-guard-extension') return;
      const { type, purchase, item } = event.data;
      // The extension may load after React; it announces itself and we reply.
      if (type === 'bridge-ready') {
        announce();
      } else if (type === 'snapshot-applied') {
        // Acknowledgement confirms that both sides have the same current money values.
        if (event.data.monthlyBudget === latest.current.snapshot.monthlyBudget &&
            event.data.currentSpent === latest.current.snapshot.currentSpent) {
          lastConfirmed.current = Date.now();
          setConnection('connected');
        }
      } else if (type === 'purchase' && latest.current.receivePurchase(purchase)) {
        post({ type: 'purchase-saved', id: purchase.id });
      } else if (type === 'cooling-item' && latest.current.receiveCoolingItem(item)) {
        post({ type: 'cooling-item-saved', id: item.id });
      }
    }
    window.addEventListener('message', onMessage);
    announce();
    // Retry the handshake, including on returning to the dashboard. A missed startup
    // message must not leave purchases queued forever with no visible explanation.
    window.addEventListener('focus', announce);
    const retry = setInterval(() => {
      if (Date.now() - lastConfirmed.current >= 15000) setConnection('disconnected');
      announce();
    }, 5000);
    return () => {
      clearInterval(retry);
      window.removeEventListener('message', onMessage);
      window.removeEventListener('focus', announce);
    };
  }, []);

  // Resend whenever the shared numbers change.
  useEffect(() => {
    setConnection('connecting');
    post(snapshot);
  }, [snapshot.monthlyBudget, snapshot.currentSpent, snapshot.cardLimit]);
  useEffect(() => post(preferences), [font, displayPreferences?.theme, displayPreferences?.view, displayPreferences?.advancedMode, displayPreferences?.textSize, displayPreferences?.spacing, displayPreferences?.reduceMotion, displayPreferences?.balanceFigure]);
  return connection;
}
