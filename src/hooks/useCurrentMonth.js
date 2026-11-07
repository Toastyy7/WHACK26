import { useEffect, useState } from 'react';
import { currentMonth } from '../statements/monthlyBalance.js';

export default function useCurrentMonth() {
  const [month, setMonth] = useState(currentMonth);
  useEffect(() => {
    const refresh = () => setMonth(currentMonth());
    // Update at a month boundary even if the demo stays open overnight.
    const interval = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return month;
}
