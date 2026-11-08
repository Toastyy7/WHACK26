import React from 'react';
import { parsePoundsToPence, getGaugeState } from '../account.js';
import { formatMoney } from '../utils/format.js';

// The preview calculates a possible balance without updating the account.
export default function PurchaseProjection({ purchase, account }) {
  // Early returns handle empty or invalid input before doing any calculations.
  if (!purchase) return 'Enter an amount to see what it would leave you.';

  const amount = parsePoundsToPence(purchase);
  if (amount === null) return 'Enter pounds with up to two decimal places.';

  const after = getGaugeState(account.balance + amount, account.limit, account.target);
  return (
    <>
      <strong>
        After this: {after.over
          ? `${formatMoney(after.over)} over your safe limit`
          : `${formatMoney(after.safeToSpend)} safe to spend`}
      </strong>
      <br />
      <span className={`badge zone-${after.zone}`}>{after.label}</span>
    </>
  );
}
