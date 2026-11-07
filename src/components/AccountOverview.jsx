import React from 'react';
import { formatMoney } from '../utils/format.js';

// Read-only summary: this component displays App’s account without changing it.
export default function AccountOverview({ account, monthlyOutgoing = 0, month }) {
  return (
    <section className="overview" aria-label="Account overview">
      <div>
        <span>Current balance</span>
        <strong aria-live="polite">{formatMoney(account.balance)}</strong>
        {monthlyOutgoing > 0 && <span className="balance-adjustment">
          After {formatMoney(monthlyOutgoing)} in selected transactions for{' '}
          {new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
            .format(new Date(`${month}-01T00:00:00Z`))}.
        </span>}
      </div>
      <div>
        <span>Credit limit</span>
        <strong>{formatMoney(account.limit)}</strong>
      </div>
    </section>
  );
}
