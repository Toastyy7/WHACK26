import { getGaugeState } from './account.js';
import { includedTransactions } from './statements/selection.js';
import { summarize } from './statements/categories.js';

// Account.balance already includes this month's purchases. Do not add them again.
export function focusSummary(account, transactions, month) {
  const rows = includedTransactions(transactions).filter(row => row.isoDate?.slice(0, 7) === month);
  const gauge = getGaugeState(account.balance, account.limit, account.target);
  return {
    owed: Math.max(0, account.balance),
    safeToSpend: gauge.safeToSpend,
    label: gauge.label,
    spending: rows.reduce((total, row) => total + row.amount, 0),
    count: rows.length,
    topCategory: summarize(rows)[0] ?? null,
  };
}
