import React, { useLayoutEffect, useState } from 'react';

function getInitialTheme() {
  // Prefer a saved choice; otherwise use the device’s appearance setting.
  try {
    const saved = localStorage.getItem('credit-guard-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Browsers may block storage; the toggle still works for this visit.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useLayoutEffect(() => {
    // CSS variables on the root apply the theme to every screen and popup.
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('credit-guard-theme', theme);
    } catch {
      // Keep the selected theme even when saving it is unavailable.
    }
  }, [theme]);

  return (
    <button className="secondary" aria-label="Dark mode" aria-pressed={theme === 'dark'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}
    </button>
  );
}
