export const initial = () => ({
  adaptive: false, balance: 28000, limit: 100000, minimum: 2500,
  target: 30, due: '14 November', plan: 'off', buffer: 5000,
  bank: 7500, freshness: 'fresh', week: 1, payments: [],
  draft: 'I may struggle to make my payment due on the 14th. Could you let me know what short-term repayment options are available? Please reply in writing.',
  support: { status: 'draft', id: 'AG-014' }
});

export function pence(value) {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  const [pounds, fraction = ''] = value.split('.');
  return Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
}

export function gauge(balance, limit, target) {
  const percentage = balance * 100 / limit;
  return {
    percentage,
    threshold: Math.ceil(limit * target / 100),
    label: percentage >= 50 ? 'Using at least half your limit'
      : percentage >= target ? 'At or above your target' : 'Within your target'
  };
}

export function runPayment(state, fail = false) {
  const { week, plan, balance, bank, freshness, buffer, minimum, payments } = state;
  if (plan !== 'active' || payments.some(payment => payment.week === week)) return state;
  const amount = Math.min(1000, balance);
  let reason = '';
  if (!amount) reason = 'There is no card balance to repay.';
  else if (freshness === 'missing') reason = 'Your available bank balance is unavailable.';
  else if (freshness === 'stale') reason = 'Your available bank balance is out of date.';
  else if (bank - amount < buffer) reason = 'This payment would leave less than your cash buffer.';
  const status = reason ? 'skipped' : fail ? 'failed' : 'posted';
  const posted = status === 'posted' ? amount : 0;
  return {
    ...state, balance: balance - posted, bank: bank - posted,
    minimum: Math.max(0, minimum - posted),
    payments: [{ week, status, amount, reason: reason || (fail ? 'The simulated payment service could not post this payment.' : '') }, ...payments]
  };
}
