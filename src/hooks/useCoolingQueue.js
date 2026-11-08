import { useEffect, useRef, useState } from 'react';
import {
  addCoolingItem, coolingStorageKey, createInitialCoolingQueue, dismissCoolingItem,
  loadCoolingQueue, saveCoolingQueue,
} from '../coolingQueue.js';

export default function useCoolingQueue() {
  const [queue, setQueue] = useState(() => {
    try { return loadCoolingQueue(window.localStorage) ?? createInitialCoolingQueue(); }
    catch { return createInitialCoolingQueue(); }
  });
  const [coolingError, setCoolingError] = useState('');
  const latest = useRef(queue);

  function persist(next) {
    saveCoolingQueue(window.localStorage, next);
    latest.current = next;
    setQueue(next);
    setCoolingError('');
  }

  // Used by the demo button and the extension bridge; true once saved.
  function add(item) {
    try {
      persist(addCoolingItem(latest.current, item));
      return true;
    } catch {
      setCoolingError('This checkout could not be saved to the reflection queue. Items from the extension stay queued and retry automatically.');
      return false;
    }
  }

  function dismiss(itemId) {
    try { persist(dismissCoolingItem(latest.current, itemId)); }
    catch { setCoolingError('The reflection queue could not be updated.'); }
  }

  function reset() {
    try { persist(createInitialCoolingQueue()); }
    catch { setCoolingError('The reflection queue could not be reset.'); }
  }

  // Keep other open dashboard tabs in step.
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== null && event.key !== coolingStorageKey) return;
      try {
        const next = loadCoolingQueue(window.localStorage) ?? createInitialCoolingQueue();
        latest.current = next;
        setQueue(next);
      } catch { setCoolingError('The saved reflection queue could not be read.'); }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { queue, addCoolingItem: add, dismissCoolingItem: dismiss, resetCoolingQueue: reset, coolingError };
}
