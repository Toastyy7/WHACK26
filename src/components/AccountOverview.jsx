import React from 'react';
import { formatMoney } from '../utils/format.js';

// Read-only summary: this component displays App’s account without changing it.
export default function AccountOverview({ account }) {
  return (
    <section className="overview" aria-label="Account overview">
      <div>
        <span>Current balance</span>
        <strong>{formatMoney(account.balance)}</strong>
      </div>
      <div>
        <span>Credit limit</span>
        <strong>{formatMoney(account.limit)}</strong>
      </div>
    </section>
  );
}
