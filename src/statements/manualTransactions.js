import { parsePoundsToPence } from '../account.js';
import { categories } from './categories.js';
import { formatDate, normalizeTransactionDate } from './dates.js';

export function createManualTransaction({ category, price, merchant, date }, id) {
  const amount = parsePoundsToPence(price);
  if (amount === null || amount <= 0) throw new Error('Enter an amount greater than £0 with up to two decimal places.');
  if (!merchant.trim() || merchant.trim().length > 200) throw new Error('Enter a merchant or payee name (up to 200 characters).');
  if (!categories.includes(category)) throw new Error('Choose a transaction type.');
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const isoDate = match && normalizeTransactionDate(`${match[3]}/${match[2]}/${match[1]}`);
  if (!isoDate) throw new Error('Choose a valid transaction date.');
  return {
    id, description: merchant.trim(), amount, category, isoDate,
    date: formatDate(isoDate), source: 'manual', page: null, included: true,
  };
}

export function appendManualTransaction(statement, transaction) {
  const saved = statement ?? {
    fileName: 'Manually added transactions', savedAt: Date.now(),
    result: { transactions: [], declaredTotal: null, pageCount: 0, supportedPages: 0, unresolved: 0 },
  };
  return { ...saved, result: { ...saved.result, transactions: [...saved.result.transactions, transaction] } };
}

// Manual additions must never change the extraction check against a PDF’s own total.
export function importedTransactions(transactions) {
  return transactions.filter((transaction) => transaction.source !== 'manual' && transaction.source !== 'checkout');
}
