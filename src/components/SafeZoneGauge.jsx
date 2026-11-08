import React, { useState } from 'react';
import PurchaseProjection from './PurchaseProjection.jsx';

// "Try a purchase first": a what-if that never changes the account.
// A valid amount compares current and projected safe-limit usage without saving it.
export default function SafeZoneGauge({ account, balanceFigure }) {
  const [purchase, setPurchase] = useState('');
  return (
    <section className="card">
      <p className="eyebrow">01 / SAFE-ZONE CHECK</p>
      <h2>Try a purchase first</h2>
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
        <PurchaseProjection purchase={purchase} account={account} balanceFigure={balanceFigure} />
      </div>
    </section>
  );
}
