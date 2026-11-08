import React from 'react';
import { getGaugeState } from '../account.js';
import { formatMoney, formatPercent } from '../utils/format.js';

// The one number the app is built around. The extension shows the same number in
// the same words (checkout-guard/content.js and popup.html), so they never disagree.
// The sum on the right shows where it comes from; Detailed view adds card details.
export default function AccountOverview({ account, detailed = false, monthlyOutgoing = 0 }) {
  const { balance, limit, target } = account;
  const owed = Math.max(0, balance);
  const gauge = getGaugeState(balance, limit, target);
  const status = gauge.over ? `${formatMoney(gauge.over)} over your safe limit` : gauge.label;
  return (
    <section className="overview" aria-label="Account overview">
      <div className="overview-main">
        <span>Safe to spend</span>
        <strong aria-live="polite">{formatMoney(gauge.safeToSpend)}</strong>
        <p className={`badge zone-${gauge.zone}`}>{status}</p>
      </div>
      <dl className="overview-sum">
        <div><dt>Safe limit</dt><dd>{formatMoney(gauge.threshold)}</dd></div>
        <div><dt>− You owe</dt><dd>{formatMoney(owed)}</dd></div>
        <div className="overview-total">
          <dt>{gauge.over ? '= Over by' : '= Safe to spend'}</dt>
          <dd>{formatMoney(gauge.over || gauge.safeToSpend)}</dd>
        </div>
      </dl>
      <div
        className={`gauge zone-${gauge.zone}`}
        role="meter"
        aria-label="Safe limit used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(gauge.width)}
        aria-valuetext={`${status}. You owe ${formatMoney(owed)} of your ${formatMoney(gauge.threshold)} safe limit.`}
      >
        <div className="gauge-fill" style={{ width: `${gauge.width}%` }} />
      </div>
      {detailed && (<>
        <dl className="overview-details">
          <div><dt>Card limit</dt><dd>{formatMoney(limit)}</dd></div>
          <div><dt>This month’s purchases</dt><dd>{formatMoney(monthlyOutgoing)}</dd></div>
          <div><dt>Card limit used</dt><dd>{formatPercent((owed * 100) / limit)}</dd></div>
          <div><dt>Safe limit used</dt><dd>{formatPercent((owed * 100) / gauge.threshold)}</dd></div>
        </dl>
        <p className="overview-key">Your safe limit is {target}% of your card limit. Green: under 80% of it · Amber: 80% up to the limit · Red: over it.</p>
      </>)}
    </section>
  );
}
