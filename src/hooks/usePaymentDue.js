import { useEffect, useState } from 'react';
import { loadPaymentDue, savePaymentDue, paymentDueKey, localDay } from '../paymentDue.js';

export default function usePaymentDue(storage) {
  function browserStorage() { return storage ?? window.localStorage; }
  const [payment, setPayment] = useState(() => {
    try { return loadPaymentDue(browserStorage()); } catch { return null; }
  });
  const [error, setError] = useState('');
  const [today, setToday] = useState(localDay);
  function updatePayment(value) {
    setPayment(value);
    try { savePaymentDue(browserStorage(), value); setError(''); }
    catch {
      setError(value ? 'Payment details are available for this visit, but could not be saved after refresh.'
        : 'Payment details were cleared here, but saved details may return after refresh because browser storage is unavailable.');
    }
  }
  useEffect(() => {
    const refresh = () => setToday(localDay());
    const timer = setInterval(refresh, 60000);
    function sync(event) {
      try {
        const store = browserStorage();
        if (event.key === null || event.key === (store.keyFor?.(paymentDueKey) ?? paymentDueKey)) setPayment(loadPaymentDue(store));
      } catch { /* Keep this visit's details when storage is unavailable. */ }
    }
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', sync);
    };
  }, [storage]);
  return { payment, updatePayment, today, paymentError: error };
}
