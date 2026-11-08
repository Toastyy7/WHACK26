import { parsePoundsToPence } from './account.js';
export const paymentDueKey = 'credit-guard-payment-due-v1';

function validDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function validPayment(value) {
  return value && Number.isSafeInteger(value.amount) && value.amount > 0 && value.amount <= 999999999 && validDate(value.date);
}
export function parsePaymentDue(amount, date) {
  const value = { amount: parsePoundsToPence(amount), date };
  return validPayment(value) ? value : null;
}
// A demo Grace acceptance gives 14 calendar days beyond whichever date is later.
// Return a new record so the original amount/date remain available to the caller.
export function extendPaymentDue(payment, today) {
  if (!validPayment(payment) || !validDate(today)) return null;
  const start = payment.date > today ? payment.date : today;
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 14);
  const next = { amount: payment.amount, date: date.toISOString().slice(0, 10) };
  return validPayment(next) ? next : null;
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
// UTC conversion of calendar strings avoids daylight-saving 23/25-hour days.
export function paymentTiming(date, today) {
  const days = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  if (days < 0) return 'Past due date';
  if (days === 0) return 'Due today';
  return `Due in ${days} ${days === 1 ? 'day' : 'days'}`;
}
export function loadPaymentDue(storage) {
  try {
    const value = JSON.parse(storage.getItem(paymentDueKey));
    return validPayment(value) ? { amount: value.amount, date: value.date } : null;
  } catch { return null; }
}
export function savePaymentDue(storage, payment) {
  if (payment === null) storage.removeItem(paymentDueKey);
  else if (validPayment(payment)) storage.setItem(paymentDueKey, JSON.stringify({ amount: payment.amount, date: payment.date }));
  else throw Error('Enter a valid payment amount and date.');
}
