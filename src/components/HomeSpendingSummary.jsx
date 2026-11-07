import React from 'react';
import { formatDate } from '../statements/dates.js';
import { formatMoney } from '../utils/format.js';
import { includedTransactions } from '../statements/selection.js';

// Home shows a simple statement snapshot; detailed analysis stays on its own screen.
export default function HomeSpendingSummary({ statement, onManage, onClear, onSelect }) {
  // Sort a copy so the original statement order is preserved in the analysis screen.
  const imported = statement.result.transactions;
  const removed = imported.filter((transaction) => transaction.included === false);
  const transactions = includedTransactions(imported).sort((a, b) =>
    (b.isoDate || '').localeCompare(a.isoDate || ''));
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const dated = transactions.map((transaction) => transaction.isoDate).filter(Boolean);
  const unverified = statement.result.declaredTotal == null || statement.result.declaredTotal !== imported.reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <section className="card home-spending">
      <h2>Your statement spending</h2>
      {dated.length > 0 && <p className="muted">{formatDate(dated.at(-1))} – {formatDate(dated[0])}</p>}
      <div className="home-spending-total">
        <span>{removed.length ? 'Selected outgoing' : 'Total outgoing'}</span>
        <strong>{formatMoney(total)}</strong>
        <p className="muted">Across {transactions.length} transactions, including transfers and cash.</p>
      </div>
      {unverified && <p className="notice">Total needs checking against your statement. See Statement analysis for details.</p>}
      <h3>Transactions</h3>
      {transactions.length === 0 && <p>No transactions selected. Add some back below.</p>}
      <ul className="home-transactions">
        {transactions.map((transaction) => (
          <li key={transaction.id}>
            <div>
              <span className="transaction-description">{transaction.description}</span>
              <span className="muted transaction-date">
                {transaction.isoDate ? formatDate(transaction.isoDate) : transaction.date || 'Date not available'}
              </span>
            </div>
            <div className="transaction-actions">
              <strong>{formatMoney(transaction.amount)}</strong>
              <button className="secondary" aria-label={`Remove ${transaction.description}, ${formatMoney(transaction.amount)}, ${transaction.date}`}
                onClick={() => onSelect(transaction.id, false)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
      {removed.length > 0 && (
        <details>
          <summary>Add removed transactions ({removed.length})</summary>
          <ul className="home-transactions">
            {removed.map((transaction) => <li key={transaction.id}>
              <div><span className="transaction-description">{transaction.description}</span>
                <span className="muted transaction-date">{transaction.isoDate ? formatDate(transaction.isoDate) : transaction.date}</span>
              </div>
              <div className="transaction-actions">
                <strong>{formatMoney(transaction.amount)}</strong>
                <button className="secondary" aria-label={`Add ${transaction.description}, ${formatMoney(transaction.amount)}, ${transaction.date}`}
                  onClick={() => onSelect(transaction.id, true)}>Add</button>
              </div>
            </li>)}
          </ul>
        </details>
      )}
      <div className="actions">
        <button className="secondary" onClick={onManage}>Statement analysis</button>
        <button className="secondary" onClick={onClear}>Remove saved statement</button>
      </div>
    </section>
  );
}
