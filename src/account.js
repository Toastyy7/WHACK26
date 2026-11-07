// All account amounts are integer pence. Convert to pounds only for display.
export const initial = () => ({
  adaptive: false,
  cardholder: 'Emil',
  balance: 28000, // £280.00
  limit: 100000,  // £1,000.00
  minimum: 2500,  // £25.00
  target: 30,     // 30% safe-zone target (£300.00)
  due: '14 November',
  payday: '1st of the month',
  directDebitDate: '2nd of the month',
  plan: 'off',
  buffer: 5000,   // £50.00
  bank: 7500,     // £75.00
  freshness: 'fresh',
  week: 1,
  payments: [],
  // 30-minute ADHD impulse cooling queue (synced with extension)
  coolingItems: [
    {
      id: 'cool-001',
      title: 'Wireless ANC Headphones',
      store: 'Apex Retail',
      amount: 6999, // £69.99
      savedAt: Date.now() - 10 * 60 * 1000,
      expiresAt: Date.now() + 20 * 60 * 1000,
    },
  ],
  impulseSavings: 0,
  // Assisted Self-Authoring Support Scaffold (FCA & SCOR compliant)
  support: {
    status: 'idle', // 'idle' | 'guided' | 'editing' | 'review' | 'submitting' | 'submitted' | 'failed'
    reason: 'unexpected_expense',
    customReason: '',
    amountAffordable: 1000, // £10.00 in pence
    recoveryDate: '1 December',
    confirmedWarning: false, // Intentional friction: Must acknowledge credit file advisory
    id: 'AG-014',
  },
  draft:
    'Dear Capital One Support Team,\n\nI am writing to let you know that I am experiencing unexpected financial pressure this month due to an essential car repair.\n\nAs a result, I will be unable to cover the full statement minimum of £25.00 due on 14 November. However, I can realistically pay £10.00 right now to demonstrate my commitment to keeping my account in good order.\n\nI expect my financial situation to stabilize by 1 December (my next payday). Could you please confirm in writing what short-term repayment arrangement options are available under FCA Consumer Duty guidelines, and whether any fees or interest can be frozen during this period?\n\nThank you for considering my circumstances.\n\nYours faithfully,\nEmil',
});

// Parse typed pounds without floating-point arithmetic. Null means invalid input.
export function pence(value) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null;
  const [pounds, fraction = ''] = clean.split('.');
  return Number(pounds) * 100 + Number(fraction.padEnd(2, '0'));
}

export function gauge(balance, limit, target) {
  const percentage = (balance * 100) / limit;
  return {
    percentage,
    threshold: Math.ceil((limit * target) / 100),
    label:
      percentage >= 50
        ? 'Using at least half your limit'
        : percentage >= target
          ? 'At or above your target'
          : 'Within your target',
  };
}

export const SUPPORT_REASONS = {
  unexpected_expense: 'an essential unexpected repair or emergency expense',
  medical_health: 'a personal health or medical situation',
  reduced_hours: 'a temporary reduction in working hours and income delay',
  living_costs: 'a sharp, temporary increase in essential household utility costs',
};

export function generateSupportDraft({
  cardholder = 'Emil',
  reasonKey = 'unexpected_expense',
  customReason = '',
  amountAffordable = 1000,
  minimum = 2500,
  due = '14 November',
  recoveryDate = '1 December',
}) {
  const reasonText = customReason.trim() || SUPPORT_REASONS[reasonKey] || 'unexpected personal financial difficulty';
  const affordablePounds = (amountAffordable / 100).toFixed(2);
  const minPounds = (minimum / 100).toFixed(2);

  return [
    'Dear Capital One Support Team,',
    `I am writing to let you know that I am experiencing unexpected financial friction this month due to ${reasonText}.`,
    `As a result, I may struggle to pay the full statement minimum of £${minPounds} due on ${due}. However, I am able to pay £${affordablePounds} right now to keep my account active and reduce my balance.`,
    `I expect my situation to stabilize by ${recoveryDate}. In accordance with the FCA Consumer Duty and guidelines on supporting customers in financial difficulty, could you please confirm what short-term support options are available in writing, and whether late fees can be suppressed while an arrangement is agreed?`,
    'I intend to stay in close communication and resume regular payments as soon as possible. Thank you for your support.',
    `Yours faithfully,\n${cardholder}`,
  ].join('\n\n');
}

export function removeCoolingItem(state, itemId) {
  const target = state.coolingItems.find((item) => item.id === itemId);
  if (!target) return state;
  return {
    ...state,
    coolingItems: state.coolingItems.filter((item) => item.id !== itemId),
    impulseSavings: (state.impulseSavings || 0) + target.amount,
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
