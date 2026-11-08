import React, { useLayoutEffect, useState } from 'react';

// Saved display preferences (kept across Reset demo). If storage is blocked,
// a choice still works for the current visit.
export function loadSetting(key, allowed, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (allowed.includes(saved)) return saved;
  } catch { /* storage blocked */ }
  return fallback;
}
function saveSetting(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

const initialTheme = () => loadSetting('credit-guard-theme', ['light', 'dark'],
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// One disclosure for every display setting, so the header stays short on phones.
export default function SettingsMenu({ view, onView, font, onFont }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);

  // CSS variables and font rules on the root apply to every screen and popup.
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveSetting('credit-guard-theme', theme);
  }, [theme]);
  useLayoutEffect(() => {
    document.documentElement.dataset.font = font;
  }, [font]);

  const switches = [
    ['Dark mode', theme === 'dark', (on) => setTheme(on ? 'dark' : 'light')],
    ['Detailed view', view === 'detailed', (on) => {
      saveSetting('credit-guard-view', on ? 'detailed' : 'simple');
      onView(on ? 'detailed' : 'simple');
    }],
    ['Dyslexia-friendly font (OpenDyslexic)', font === 'dyslexic', (on) => {
      saveSetting('credit-guard-font', on ? 'dyslexic' : 'default');
      onFont(on ? 'dyslexic' : 'default');
    }],
  ];

  return (
    <div className="navigation-menu"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          event.currentTarget.querySelector('button').focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button className="secondary" aria-expanded={open} aria-controls="settings-panel" onClick={() => setOpen(!open)}>
        ⚙ Settings
      </button>
      {/* tabIndex -1: pressing on a label's text keeps focus inside, so the menu doesn't close mid-click. */}
      <div id="settings-panel" className="navigation-options settings-panel" role="group" aria-label="Settings" hidden={!open} tabIndex={-1}>
        {switches.map(([label, on, set]) => (
          <label key={label} className="setting">
            <span>{label}</span>
            {/* A real checkbox styled as a switch: keyboard, screen readers and forms keep working. */}
            <input type="checkbox" role="switch" checked={on} onChange={(event) => set(event.target.checked)} />
          </label>
        ))}
      </div>
    </div>
  );
}
