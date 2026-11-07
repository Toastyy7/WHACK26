import React from 'react';
import { formatDate } from '../statements/dates.js';
import { formatMoney } from '../utils/format.js';

// Home shows a simple statement snapshot; detailed analysis stays on its own screen.
export default function HomeSpendingSummary({ statement, onManage, onClear }) {
  // Sort a copy so the original statement order is preserved in the analysis screen.
  const transactions = [...statement.result.transactions].sort((a, b) =>
    (b.isoDate || '').localeCompare(a.isoDate || ''));
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const dated = transactions.map((transaction) => transaction.isoDate).filter(Boolean);
  const unverified = statement.result.declaredTotal == null || statement.result.declaredTotal !== total;

  return (
    <section className="card home-spending">
      <h2>Your statement spending</h2>
      {dated.length > 0 && <p className="muted">{formatDate(dated.at(-1))} – {formatDate(dated[0])}</p>}
      <div className="home-spending-total">
        <span>Total outgoing</span>
        <strong>{formatMoney(total)}</strong>
        <p className="muted">Across {transactions.length} transactions, including transfers and cash.</p>
      </div>
      {unverified && <p className="notice">Total needs checking against your statement. See Statement analysis for details.</p>}
      <h3>Transactions</h3>
      <ul className="home-transactions">
        {transactions.map((transaction) => (
          <li key={transaction.id}>
            <div>
              <span className="transaction-description">{transaction.description}</span>
              <span className="muted transaction-date">
                {transaction.isoDate ? formatDate(transaction.isoDate) : transaction.date || 'Date not available'}
              </span>
            </div>
            <strong>{formatMoney(transaction.amount)}</strong>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button className="secondary" onClick={onManage}>Statement analysis</button>
        <button className="secondary" onClick={onClear}>Remove saved statement</button>
      </div>
    </section>
  );
}
