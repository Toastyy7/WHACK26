import React from 'react';

const key = 'credit-guard-view';

// Simple (default) shows one number and its sum; Detailed adds card details and
// percentages. The headline "Safe to spend" is the same in both views.
export function getInitialView() {
  try {
    return localStorage.getItem(key) === 'detailed' ? 'detailed' : 'simple';
  } catch {
    return 'simple';  // Storage may be blocked; the toggle still works for this visit.
  }
}

export default function ViewToggle({ view, onChange }) {
  const detailed = view === 'detailed';
  function toggle() {
    const next = detailed ? 'simple' : 'detailed';
    try { localStorage.setItem(key, next); } catch { /* keep the choice for this visit */ }
    onChange(next);
  }
  return (
    <button className="secondary" aria-label="Detailed view" aria-pressed={detailed} onClick={toggle}>
      {detailed ? '◧ Simple view' : '▤ Detailed view'}
    </button>
  );
}
