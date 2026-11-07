// All account amounts are integer pence. Convert to pounds only for display.
// Return a new object each time so Reset starts with a fresh copy of the demo data.
export const createInitialAccount = () => ({
  balance: 28000, // £280 currently owed on the card.
  limit: 100000, // £1,000 credit limit.
  target: 30, // Customer-selected percentage used by the gauge.
  draft:
    'I may struggle to make my payment. Could you let me know what short-term repayment options are available? Please reply in writing.',
  support: { status: 'draft', id: 'AG-014' },
});

// Parse typed pounds without floating-point arithmetic. Null means invalid input.
export function parsePoundsToPence(value) {
  if (typeof value !== 'string') return null;
  // Tolerate surrounding spaces, '.50' and '12.' as people actually type them.
  const text = value.trim().replace(/^\./, '0.');
  // Accept up to seven whole-pound digits and optionally up to two decimal digits.
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(text)) return null;
  // For '12.5', padEnd turns the fraction '5' into '50': 1200 + 50 pence.
  const [pounds, fraction = ''] = text.split('.');
  return Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
}

// Pure calculation: return display values without changing the account.
// These labels describe the chosen target, rather than predicting a credit score.
export function getGaugeState(balance, limit, target) {
  // A balance below zero has no credit limit in use; keep the gauge at zero.
  const percentage = (Math.max(0, balance) * 100) / limit;
  // The colour follows the same boundaries as the text label.
  let zone = 'green';
  let label = 'Within your target';
  if (percentage >= 50) {
    zone = 'red';
    label = 'Using at least half your limit';
  } else if (percentage >= target) {
    zone = 'amber';
    label = 'At or above your target';
  }
  if (balance > limit) label = 'Credit limit exceeded';

  return {
    percentage,
    zone,
    // Convert the target percentage to pence, rounding up to a whole penny.
    threshold: Math.ceil((limit * target) / 100),
    label,
  };
}
