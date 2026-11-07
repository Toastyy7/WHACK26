import React from 'react';
import { parsePoundsToPence, getGaugeState } from '../account.js';
import { formatMoney, formatPercent } from '../utils/format.js';

// The preview calculates a possible balance without updating the account.
export default function PurchaseProjection({ purchase, account }) {
  // Early returns handle empty or invalid input before doing any calculations.
  if (!purchase) return 'Enter an amount to see a what-if preview.';

  const amount = parsePoundsToPence(purchase);
  if (amount === null) return 'Enter pounds with up to two decimal places.';

  const { balance, limit, target } = account;
  const projectedBalance = balance + amount;
  const projected = getGaugeState(projectedBalance, limit, target);
  // A positive difference means above the target; a negative one means below it.
  const difference = projectedBalance - projected.threshold;

  let targetMessage = `Exactly at your ${formatMoney(projected.threshold)} target.`;
  if (difference !== 0) {
    const direction = difference > 0 ? 'above' : 'below';
    targetMessage = `${formatMoney(Math.abs(difference))} ${direction} your ${formatMoney(projected.threshold)} target.`;
  }

  return (
    <>
      <strong>
        {formatMoney(projectedBalance)} of {formatMoney(limit)} (
        {formatPercent(projected.percentage)})
      </strong>
      <br />
      <span className={`badge zone-${projected.zone}`}>{projected.label}</span>
      <br />
      {targetMessage}
      {projectedBalance > limit && ' This would exceed your credit limit.'}
    </>
  );
}
