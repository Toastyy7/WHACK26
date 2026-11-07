import { useState } from 'react';
import { loadStatement, saveStatement } from '../statements/storage.js';

export default function useSavedStatement() {
  const [savedStatement, setSavedStatement] = useState(() => {
    try { return loadStatement(window.localStorage); } catch { return null; }
  });
  const [storageError, setStorageError] = useState('');

  function updateSavedStatement(statement) {
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

  return { savedStatement, updateSavedStatement, storageError };
}
