import { includedTransactions } from './selection.js';

// Use the browser’s local calendar month, including the year.
export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthlyBalance(baseBalance, transactions, month) {
  const selected = includedTransactions(transactions);
  const outgoing = selected
    .filter((transaction) => transaction.isoDate?.slice(0, 7) === month)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  // Derive the result instead of changing the original balance. This prevents
  // repeat deductions on refresh and restores money when a transaction is removed.
  return { balance: baseBalance - outgoing, outgoing };
}
