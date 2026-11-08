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

  // Called by the extension bridge. Returns true only once the purchase is durably saved.
  function receivePurchase(purchase) {
    try {
      const next = receiveCheckout(window.localStorage, latest.current, purchase);
      latest.current = next;
      setSavedStatement(next);
      setStorageError('');
      return true;
    } catch {
      setStorageError('A checkout could not be saved. It remains queued in the extension and will retry when browser storage is available.');
      return false;
    }
  }

  // Keep other open dashboard tabs in step.
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== null && event.key !== 'credit-guard-statement-v1') return;
      const next = loadStatement(window.localStorage);
      latest.current = next;
      setSavedStatement(next);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { savedStatement, updateSavedStatement, receivePurchase, storageError };
}
