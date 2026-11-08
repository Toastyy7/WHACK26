// Display-only amounts, in integer pence. The safe-limit gauge is independent.
export const balanceFigures = [
  { value: 'safe-to-spend', label: 'Safe to spend', description: 'Your chosen safe limit minus what you owe.' },
  { value: 'card-remaining', label: 'Card limit remaining', description: 'Your full card limit minus what you owe. Your safe-to-spend amount can be lower.' },
  { value: 'owed', label: 'What you owe', description: 'The amount currently owed on your card.' },
];

export function getBalanceFigure(mode, { safeLimit, owed, cardLimit }) {
  const choice = balanceFigures.find((item) => item.value === mode) ?? balanceFigures[0];
  const balance = Math.max(0, owed);
  const amount = choice.value === 'owed' ? balance : choice.value === 'card-remaining'
    ? Number.isSafeInteger(cardLimit) && cardLimit > 0 ? Math.max(0, cardLimit - balance) : null
    : Math.max(0, safeLimit - balance);
  return { label: choice.label, description: choice.description, amount };
}
