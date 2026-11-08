import { parsePoundsToPence } from '../account.js';
import { categories } from './categories.js';
import { formatDate, normalizeTransactionDate } from './dates.js';

export function reviewRows(result) {
  return result.transactions.map((row) => ({ ...row,
    price: `${Math.floor(row.amount / 100)}.${String(row.amount % 100).padStart(2, '0')}`,
    isoDate: row.isoDate || '',
    included: row.amount > 0 && Boolean(row.isoDate) && (row.confidence ?? 100) >= 65,
  }));
}

export function reviewedResult(result, rows) {
  const transactions = [];
  for (const row of rows) {
    const amount = parsePoundsToPence(row.price);
    const match = row.isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const isoDate = match && normalizeTransactionDate(`${match[3]}/${match[2]}/${match[1]}`);
    const valid = amount !== null && amount >= 0 && isoDate && row.description.trim() && categories.includes(row.category);
    if (row.included && (!valid || amount === 0)) throw new Error('Check each selected row: enter a description, valid date, category and amount greater than £0.');
    if (!valid) continue;
    const { price, ...original } = row;
    transactions.push({ ...original, amount, isoDate, date: formatDate(isoDate), description: row.description.trim(), source: 'statement', included: Boolean(row.included) });
  }
  if (!transactions.some((row) => row.included)) throw new Error('Select at least one valid outgoing transaction to import.');
  return { ...result, transactions, reviewed: true };
}
