// Account amounts are stored in pence; format them as pounds for display.
const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
// Divide by 100 because the stored amount is pence, while Intl expects pounds.
export const formatMoney = (amount) => gbp.format(amount / 100);
// The gauge already returns a percentage (28, for example), so just append %.
export const formatPercent = (amount) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(amount) +
  '%';

