import React from 'react';
import { getGaugeState } from '../account.js';
import { formatMoney } from '../utils/format.js';

// The one number the app is built around. The extension shows the same number in
// the same words (checkout-guard/content.js and popup.html), so they never disagree.
export default function AccountOverview({ account }) {
  const { balance, limit, target } = account;
  const gauge = getGaugeState(balance, limit, target);
  const status = gauge.over ? `${formatMoney(gauge.over)} over your safe limit` : gauge.label;
  const detail = `You owe ${formatMoney(Math.max(0, balance))} of your ${formatMoney(gauge.threshold)} safe limit.`;
  return (
    <section className="overview" aria-label="Account overview">
      <span>Safe to spend</span>
      <strong aria-live="polite">{formatMoney(gauge.safeToSpend)}</strong>
      <div
        className={`gauge zone-${gauge.zone}`}
        role="meter"
        aria-label="Safe limit used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(gauge.width)}
        aria-valuetext={`${status}. ${detail}`}
      >
        <div className="gauge-fill" style={{ width: `${gauge.width}%` }} />
      </div>
      <p className={`badge zone-${gauge.zone}`}>{status}</p>
      <p className="overview-detail">{detail} Card limit {formatMoney(limit)}.</p>
    </section>
  );
}
