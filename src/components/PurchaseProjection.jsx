import React from 'react';
import { parsePoundsToPence, getGaugeState } from '../account.js';
import { formatMoney } from '../utils/format.js';
import { getBalanceFigure } from '../balanceFigure.js';

// The preview calculates a possible balance without updating the account.
export default function PurchaseProjection({ purchase, account, balanceFigure = 'safe-to-spend' }) {
  // Early returns handle empty or invalid input before doing any calculations.
  if (!purchase) return 'Enter an amount to see what it would leave you.';

  const amount = parsePoundsToPence(purchase);
  if (amount === null) return 'Enter pounds with up to two decimal places.';

  const projectedBalance = account.balance + amount;
  const before = getGaugeState(account.balance, account.limit, account.target);
  const after = getGaugeState(projectedBalance, account.limit, account.target);
  const figure = getBalanceFigure(balanceFigure, { safeLimit: after.threshold, owed: Math.max(0, projectedBalance), cardLimit: account.limit });
  const comparisons = [
    { key: 'now', title: 'Now', meterLabel: 'Safe limit used now', gauge: before, owed: Math.max(0, account.balance) },
    { key: 'after', title: 'After this purchase', meterLabel: 'Safe limit used after this purchase', gauge: after, owed: Math.max(0, projectedBalance) },
  ];
  return (
    <>
      {balanceFigure !== 'safe-to-spend' && <p><strong>{figure.label} after this: {formatMoney(figure.amount)}</strong></p>}
      <div className="projection-comparison" role="group" aria-label="Purchase impact comparison">
        <h3>Your safe limit, before and after</h3>
        <p className="muted">Both bars use your {formatMoney(after.threshold)} safe limit. Preview only: your account balance stays the same.</p>
        <div className="projection-comparison-grid">
          {comparisons.map(({ key, title, meterLabel, gauge, owed }) => {
            const safeAmount = gauge.over
              ? `${formatMoney(gauge.over)} over your safe limit`
              : `${formatMoney(gauge.safeToSpend)} safe to spend`;
            return (
              <div key={key} className="projection-comparison-card">
                <h4>{title}</h4>
                <div className={`gauge zone-${gauge.zone}`} role="meter" aria-label={meterLabel}
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gauge.width)}
                  aria-valuetext={`${gauge.label}. You owe ${formatMoney(owed)} of your ${formatMoney(gauge.threshold)} safe limit. ${safeAmount}.`}>
                  <div className="gauge-fill" style={{ width: `${gauge.width}%` }} />
                </div>
                <p>You owe {formatMoney(owed)}</p>
                <p><strong>{key === 'after' ? 'After this: ' : 'Now: '}{safeAmount}</strong></p>
                {key === 'after'
                  ? <span className={`badge zone-${gauge.zone}`}>{gauge.label}</span>
                  : <p className="projection-current-status">{gauge.label}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
