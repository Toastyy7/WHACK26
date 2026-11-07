import { useEffect, useRef, useState } from 'react';
import { receiveCheckout } from '../statements/checkoutSync.js';
import { loadStatement, saveStatement } from '../statements/storage.js';

export default function useSavedStatement() {
  const [savedStatement, setSavedStatement] = useState(() => {
    try { return loadStatement(window.localStorage); } catch { return null; }
  });
  const [storageError, setStorageError] = useState('');
  const latest = useRef(savedStatement);

  function updateSavedStatement(statement) {
    latest.current = statement;
    setSavedStatement(statement);
    try {
      saveStatement(window.localStorage, statement);
      setStorageError('');
    } catch {
      setStorageError(statement
        ? 'Results are available for this visit, but browser storage is unavailable or full. They could not be saved after refresh.'
        : 'The on-screen results were cleared, but browser storage could not be cleared. Saved results may return after refresh.');
    }
  }

  useEffect(() => {
    const ready = () => window.postMessage({ source: 'credit-guard-dashboard', type: 'ready' }, location.origin);
    function onMessage(event) {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'checkout-guard-extension') return;
      if (event.data.type === 'bridge-ready') { ready(); return; }
      if (event.data.type !== 'purchase') return;
      try {
        const next = receiveCheckout(window.localStorage, latest.current, event.data.purchase);
        latest.current = next;
        setSavedStatement(next);
        setStorageError('');
        window.postMessage({ source: 'credit-guard-dashboard', type: 'purchase-saved', id: event.data.purchase.id }, location.origin);
      } catch {
        setStorageError('A checkout could not be saved. It remains queued in the extension and will retry when browser storage is available.');
      }
    }
    function onStorage(event) {
      if (event.key !== null && event.key !== 'credit-guard-statement-v1') return;
      const next = loadStatement(window.localStorage);
      latest.current = next;
      setSavedStatement(next);
    }
    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    ready();
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { savedStatement, updateSavedStatement, storageError };
}
