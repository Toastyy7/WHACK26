import React, { useState, useRef } from 'react';
import { createInitialAccount } from './account.js';
import AccountOverview from './components/AccountOverview.jsx';
import SafeZoneGauge from './components/SafeZoneGauge.jsx';
import SilentGrace from './components/SilentGrace.jsx';
import DemoControls from './components/DemoControls.jsx';

// App owns the data shared by the panels below. Props pass that data to each panel.
export default function App() {
  // useState remembers a value between renders; its setter updates the screen.
  // Passing the function here creates the starting account on the first render.
  const [account, setAccount] = useState(createInitialAccount);
  // This demo switch lets us try the support form’s retry behaviour.
  const [simulateSupportFailure, setSupportFailure] = useState(false);
  // Changing this key tells React to recreate the panels and clear their local state.
  const [resetKey, setResetKey] = useState(0);
  // useRef keeps the pending timeout ID without causing a render when it changes.
  // Keeping it here lets Reset cancel a submission started in SilentGrace.
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
    setSupportFailure(false);
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
          <SilentGrace
            account={account}
            updateAccount={updateAccount}
            fail={simulateSupportFailure}
            timer={timer}
          />
        </div>
        {/* Pass a setter as a prop so the controls can change App’s demo switch. */}
        <DemoControls
          account={account}
          updateAccount={updateAccount}
          simulateSupportFailure={simulateSupportFailure}
          setSupportFailure={setSupportFailure}
        />
      </div>
      <footer>Hackathon prototype · All account activity is simulated.</footer>
    </main>
  );
}
