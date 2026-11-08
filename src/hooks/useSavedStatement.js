import { useEffect, useRef, useState } from 'react';
import { receiveCheckout } from '../statements/checkoutSync.js';
import { loadStatement, saveStatement } from '../statements/storage.js';

// `storage` is the current account's storage (src/auth/scopedStorage.js); defaults to the browser's.
export default function useSavedStatement(storage = window.localStorage) {
  const [savedStatement, setSavedStatement] = useState(() => {
    try { return loadStatement(storage); } catch { return null; }
  });
  const [storageError, setStorageError] = useState('');
  const latest = useRef(savedStatement);

  function updateSavedStatement(statement) {
    latest.current = statement;
    setSavedStatement(statement);
    try {
      saveStatement(storage, statement);
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
      const next = receiveCheckout(storage, latest.current, purchase);
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
      if (event.key !== null && event.key !== (storage.keyFor?.('credit-guard-statement-v1') ?? 'credit-guard-statement-v1')) return;
      const next = loadStatement(storage);
      latest.current = next;
      setSavedStatement(next);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { savedStatement, updateSavedStatement, receivePurchase, storageError };
}
