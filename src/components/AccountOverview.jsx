import React from 'react';
import { formatMoney } from '../utils/format.js';

// Read-only summary: this component displays App’s account without changing it.
// "Left to spend" is the headline and uses the same words and maths as the
// CheckoutGuard extension, so both always show one number.
export default function AccountOverview({ account, monthlyBudget, monthlyOutgoing = 0, month }) {
  const over = monthlyOutgoing - monthlyBudget;
  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
  return (
    <section className="overview" aria-label="Account overview">
      <div>
        <span>Left to spend this month</span>
        <strong aria-live="polite">{formatMoney(Math.max(0, -over))}</strong>
        <span className="balance-adjustment">
          {over > 0 ? `${formatMoney(over)} over your budget. ` : ''}
          {formatMoney(monthlyOutgoing)} spent of your {formatMoney(monthlyBudget)} budget for {monthName}.
        </span>
      </div>
      <div>
        <span>Owed on card</span>
        <strong>{formatMoney(account.balance)}</strong>
        <span className="balance-adjustment">of your {formatMoney(account.limit)} credit limit</span>
      </div>
    </section>
  );
}
