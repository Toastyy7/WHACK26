// Only the demo decision is random. A real lender would supply the outcome.
// Accept a random-number function so tests can check both outcomes reliably.
export function advanceGraceStatus(status, random = Math.random) {
  if (status === 'submitted') return 'reviewing';
  if (status === 'reviewing') return random() < 0.5 ? 'accepted' : 'declined';
  return status;
}
import { extendPaymentDue } from './paymentDue.js';


// Only the transition into accepted moves a payment. Calling this again with a
// terminal decision is a no-op, rather than adding another fourteen days.
export function advanceGraceRequest(support, payment, today, random = Math.random) {
  const status = advanceGraceStatus(support.status, random);
  if (status === support.status) return { support, payment };
  const nextSupport = { ...support, status };
  if (status !== 'accepted') return { support: nextSupport, payment };
  const extended = extendPaymentDue(payment, today);
  return {
    support: { ...nextSupport, paymentDate: extended?.date ?? null },
    payment: extended ?? payment,
  };
}
