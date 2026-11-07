// Only the demo decision is random. A real lender would supply the outcome.
// Accept a random-number function so tests can check both outcomes reliably.
export function advanceGraceStatus(status, random = Math.random) {
  if (status === 'submitted') return 'reviewing';
  if (status === 'reviewing') return random() < 0.5 ? 'accepted' : 'declined';
  return status;
}
