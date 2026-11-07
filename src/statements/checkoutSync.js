import { categorize } from './categories.js';
import { createManualTransaction, appendManualTransaction } from './manualTransactions.js';
import { loadStatement, saveStatement } from './storage.js';

const receiptKey = 'credit-guard-checkout-receipts-v1';

export function checkoutTransaction(purchase) {
  if (purchase?.version !== 1 || typeof purchase.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(purchase.id) ||
      purchase.currency !== 'GBP' || !Number.isSafeInteger(purchase.amount) || purchase.amount <= 0 || purchase.amount > 999999999 ||
      typeof purchase.merchant !== 'string' || typeof purchase.date !== 'string') throw new Error('Invalid checkout event.');
  const price = `${Math.floor(purchase.amount / 100)}.${String(purchase.amount % 100).padStart(2, '0')}`;
  const row = createManualTransaction({ category: categorize(purchase.merchant), price,
    merchant: purchase.merchant, date: purchase.date }, `checkout-${purchase.id}`);
  return { ...row, source: 'checkout', status: 'planned' };
}

// Acknowledge only after durable saving. Receipts hold IDs only and survive demo
// resets so a delayed retry cannot re-add a transaction the user has cleared.
export function receiveCheckout(storage, currentStatement, purchase) {
  const row = checkoutTransaction(purchase);
  const receipts = JSON.parse(storage.getItem(receiptKey) || '[]');
  if (!Array.isArray(receipts) || !receipts.every((id) => typeof id === 'string')) throw new Error('Checkout receipt storage is invalid.');
  const latest = loadStatement(storage) ?? currentStatement;
  if (receipts.includes(purchase.id)) return latest;
  const exists = latest?.result.transactions.some((transaction) => transaction.id === row.id);
  let next = exists ? latest : appendManualTransaction(latest, row);
  if (!latest) next = { ...next, fileName: 'Checkout transactions' };
  saveStatement(storage, next);
  storage.setItem(receiptKey, JSON.stringify([...receipts, purchase.id]));
  return next;
}
