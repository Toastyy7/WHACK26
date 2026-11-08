import React from 'react';
import { getGaugeState } from '../account.js';
import { formatMoney, formatPercent } from '../utils/format.js';
import { getBalanceFigure } from '../balanceFigure.js';

// The chosen headline is shared with the extension. The safe-limit sum and gauge
// remain visible so the full card allowance cannot be mistaken for safe to spend.
export default function AccountOverview({ account, detailed = false, monthlyOutgoing = 0, balanceFigure = 'safe-to-spend' }) {
  const { balance, limit, target } = account;
  const owed = Math.max(0, balance);
  const gauge = getGaugeState(balance, limit, target);
  const status = gauge.over ? `${formatMoney(gauge.over)} over your safe limit` : gauge.label;
  const figure = getBalanceFigure(balanceFigure, { safeLimit: gauge.threshold, owed, cardLimit: limit });
  return (
    <section className="overview" aria-label="Account overview">
      <div className="overview-main">
        <div className="balance-headline" aria-live="polite" aria-atomic="true">
          <span>{figure.label}</span>
          <strong>{formatMoney(figure.amount)}</strong>
        </div>
        <p className="balance-explanation">{figure.description}</p>
        {balanceFigure !== 'safe-to-spend' && <p className="balance-safe">Safe to spend: <b>{formatMoney(gauge.safeToSpend)}</b></p>}
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
