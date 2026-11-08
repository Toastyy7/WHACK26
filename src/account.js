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
// One money model for the whole app (dashboard and extension): the safe limit is the
// chosen target share of the card limit, and "safe to spend" is what is left of it.
// Bands match checkout-guard/core.js impact(). They are not a credit-score prediction.
export function getGaugeState(balance, limit, target) {
  // Convert the target percentage to pence, rounding up to a whole penny.
  const threshold = Math.ceil((limit * target) / 100);
  // A balance below zero means nothing is owed.
  const owed = Math.max(0, balance);
  const used = (owed * 100) / threshold;
  let zone = 'green';
  let label = 'Within your safe limit';
  if (owed > limit) {
    zone = 'red';
    label = 'Over your card limit';
  } else if (owed > threshold) {
    zone = 'red';
    label = 'Over your safe limit';
  } else if (used >= 80) {
    zone = 'amber';
    label = 'Close to your safe limit';
  }
  return {
    threshold,
    safeToSpend: Math.max(0, threshold - owed),
    over: Math.max(0, owed - threshold),
    // Share of the safe limit used; the bar is capped at full.
    width: Math.min(100, used),
    zone,
    label,
  };
}
