// All account amounts are integer pence. Convert to pounds only for display.
export const initial = () => ({
  adaptive: true,
  balance: 28000,
  limit: 100000,
  minimum: 2500,
  target: 30,
  due: '14 November',
  plan: 'off',
  buffer: 5000,
  bank: 7500,
  freshness: 'fresh',
  week: 1,
  payments: [],
  draft:
    'I may struggle to make my payment due on the 14th. Could you let me know what short-term repayment options are available? Please reply in writing.',
  support: { status: 'draft', id: 'AG-014' },
});

// Parse typed pounds without floating-point arithmetic. Null means invalid input.
export function pence(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/^\./, '0.');
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(text)) return null;
  const [pounds, fraction = ''] = text.split('.');
  return Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
}

export function gauge(balance, limit, target) {
  const percentage = (balance * 100) / limit;
  return {
    percentage,
    zone: percentage >= 50 ? 'danger' : percentage >= target ? 'warning' : 'safe',
    threshold: Math.ceil((limit * target) / 100),
    label:
      balance > limit
        ? 'Credit limit exceeded'
        : percentage >= 50
          ? 'Using at least half your limit'
          : percentage >= target
            ? 'At or above your target'
            : 'Within your target',
  };
}

export function runPayment(state, fail = false) {
  const { week, plan, balance, bank, freshness, buffer, minimum, payments } =
    state;
  // The history doubles as a record of which weekly checks already ran.
  if (plan !== 'active' || payments.some((payment) => payment.week === week))
    return state;
  const weeklyPayment = 1000; // £10 in pence
  const amount = Math.min(weeklyPayment, balance);
  let reason = '';
  if (!amount) reason = 'There is no card balance to repay.';
  else if (freshness === 'missing')
    reason = 'Your available bank balance is unavailable.';
  else if (freshness === 'stale')
    reason = 'Your available bank balance is out of date.';
  else if (bank - amount < buffer)
    reason = 'This payment would leave less than your cash buffer.';
  const status = reason ? 'skipped' : fail ? 'failed' : 'posted';
  // In this fixture, each posted payment counts toward the current statement.
  // A skipped or failed check records an outcome without moving money.
  const posted = status === 'posted' ? amount : 0;
  return {
    ...state,
    balance: balance - posted,
    bank: bank - posted,
    minimum: Math.max(0, minimum - posted),
    payments: [
      {
        week,
        status,
        amount,
        reason:
          reason ||
          (fail
            ? 'The simulated payment service could not post this payment.'
            : ''),
      },
      ...payments,
    ],
  };
}
