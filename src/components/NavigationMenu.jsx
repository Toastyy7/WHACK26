import React, { useState } from 'react';

// A disclosure button reveals ordinary navigation buttons for keyboard and mouse users.
export default function NavigationMenu({ page, onNavigate }) {
  const [open, setOpen] = useState(false);

  function navigate(destination) {
    setOpen(false);
    onNavigate(destination);
  }

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
      <button className="secondary" aria-expanded={open} aria-controls="navigation-options"
        onClick={() => setOpen(!open)}>
        ☰ Menu
      </button>
      <nav id="navigation-options" className="navigation-options" aria-label="Main navigation" hidden={!open}>
        <button className="secondary" aria-current={page === 'home' ? 'page' : undefined}
          onClick={() => navigate('home')}>Home</button>
        <button className="secondary" aria-current={page === 'grace' ? 'page' : undefined}
          onClick={() => navigate('grace')}>Request Grace</button>
        <button className="secondary" aria-current={page === 'statements' ? 'page' : undefined}
          onClick={() => navigate('statements')}>Statement analysis</button>
      </nav>
    </div>
  );
}
