import React, { useState, useRef } from 'react';
import { createInitialAccount } from './account.js';
import AccountOverview from './components/AccountOverview.jsx';
import SafeZoneGauge from './components/SafeZoneGauge.jsx';
import RequestGrace from './components/RequestGrace.jsx';
import DemoControls from './components/DemoControls.jsx';

// App owns the data shared by the panels below. Props pass that data to each panel.
export default function App() {
  // useState remembers a value between renders; its setter updates the screen.
  // Passing the function here creates the starting account on the first render.
  const [account, setAccount] = useState(createInitialAccount);
  // Changing this key tells React to recreate the panels and clear their local state.
  const [resetKey, setResetKey] = useState(0);
  // useRef keeps the pending timeout ID without causing a render when it changes.
  // Keeping it here lets Reset cancel a submission started in RequestGrace.
  const timer = useRef(null);

  // Merge just the changed fields, keeping the rest of the account.
  // The callback receives the latest state, even if React queues several updates.
  function updateAccount(change) {
    setAccount((state) => ({ ...state, ...change }));
  }

  function reset() {
    // Discard a pending submission before restoring the demo fixture.
    clearTimeout(timer.current);
    timer.current = null;
    setAccount(createInitialAccount());
    // Remount the panels to clear local inputs and close the demo controls.
    setResetKey((key) => key + 1);
  }
  return (
    <main>
      <header>
        <span className="brand">◈ &nbsp; Adaptive Credit Guard</span>
        <button className="secondary" onClick={reset}>
          Reset demo
        </button>
      </header>
      <div className="intro">
        <p className="eyebrow">CAPITAL ONE HACKATHON · SIMULATED ACCOUNT</p>
        <h1>Emil’s credit card</h1>
        <p>See what you owe and what you can do next.</p>
      </div>
      <AccountOverview account={account} />
      <div key={resetKey}>
        <div className="grid">
          <SafeZoneGauge account={account} />
          <RequestGrace
            account={account}
            updateAccount={updateAccount}
            timer={timer}
          />
        </div>
        <DemoControls
          account={account}
          updateAccount={updateAccount}
        />
      </div>
      <footer>Hackathon prototype · All account activity is simulated.</footer>
    </main>
  );
}
