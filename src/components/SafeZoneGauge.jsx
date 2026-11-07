import React, { useState } from 'react';
import { getGaugeState } from '../account.js';
import { formatMoney, formatPercent } from '../utils/format.js';
import PurchaseProjection from './PurchaseProjection.jsx';

export default function SafeZoneGauge({ account }) {
  // A what-if purchase stays local to the preview and never changes the ledger.
  const [purchase, setPurchase] = useState('');
  // Destructuring gives short names to the account fields used in this panel.
  const { balance, limit, target } = account;
  const current = getGaugeState(balance, limit, target);
  return (
    <section className="card">
      <p className="eyebrow">01 / SAFE-ZONE GAUGE</p>
      <h2>Understand your balance</h2>
      <p>
        <strong>{formatMoney(balance)}</strong> of {formatMoney(limit)} used ·{' '}
        {formatPercent(current.percentage)}
      </p>
      {/* Cap the visual bar at 100%; the text still shows the actual percentage. */}
      <div
        className={`gauge zone-${current.zone}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, current.percentage)}
        aria-valuetext={`${formatPercent(current.percentage)} used · ${current.label}`}
        aria-label="Current credit limit used"
      >
        <div
          className="gauge-fill"
          style={{ width: `${Math.min(100, current.percentage)}%` }}
        />
      </div>
      <p className={`badge zone-${current.zone}`}>{current.label}</p>
      <p className="gauge-legend">
        Green: below {target}% · Amber: {target}% to below 50% · Red: 50% or more
      </p>
      <label>
        What would a purchase cost (£)?
        {/* value + onChange make React the source of truth for the typed text. */}
        <input
          inputMode="decimal"
          value={purchase}
          onChange={(e) => setPurchase(e.target.value)}
          aria-describedby="projection"
        />
      </label>
      <button
        className="secondary"
        onClick={() => setPurchase('')}
        disabled={!purchase}
      >
        Clear preview
      </button>
      {/* role="status" lets screen readers announce changes to the preview. */}
      <div id="projection" className="result" role="status">
        <PurchaseProjection purchase={purchase} account={account} />
      </div>
    </section>
  );
}

