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

  function add(item) {
    try { persist(addCoolingItem(latest.current, item)); }
    catch { setCoolingError('This checkout could not be saved to the reflection queue.'); }
  }

  function dismiss(itemId) {
    try { persist(dismissCoolingItem(latest.current, itemId)); }
    catch { setCoolingError('The reflection queue could not be updated.'); }
  }

  function reset() {
    try { persist(createInitialCoolingQueue()); }
    catch { setCoolingError('The reflection queue could not be reset.'); }
  }

  useEffect(() => {
    const ready = () => window.postMessage({ source: 'credit-guard-dashboard', type: 'ready' }, location.origin);
    function onMessage(event) {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'checkout-guard-extension') return;
      if (event.data.type === 'bridge-ready') { ready(); return; }
      if (event.data.type !== 'cooling-item') return;
      try {
        persist(addCoolingItem(latest.current, event.data.item));
        window.postMessage({ source: 'credit-guard-dashboard', type: 'cooling-item-saved', id: event.data.item.id }, location.origin);
      } catch {
        setCoolingError('A paused checkout remains queued in the extension and will retry when browser storage is available.');
      }
    }
    function onStorage(event) {
      if (event.key !== null && event.key !== coolingStorageKey) return;
      try {
        const next = loadCoolingQueue(window.localStorage) ?? createInitialCoolingQueue();
        latest.current = next;
        setQueue(next);
      } catch { setCoolingError('The saved reflection queue could not be read.'); }
    }
    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    ready();
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { queue, addCoolingItem: add, dismissCoolingItem: dismiss, resetCoolingQueue: reset, coolingError };
}
