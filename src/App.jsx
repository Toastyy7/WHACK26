import React, { useState, useRef } from 'react';
import { createInitialAccount } from './account.js';
import AccountOverview from './components/AccountOverview.jsx';
import SafeZoneGauge from './components/SafeZoneGauge.jsx';
import RequestGrace from './components/RequestGrace.jsx';
import DemoControls from './components/DemoControls.jsx';
import NavigationMenu from './components/NavigationMenu.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import StatementAnalysis from './components/StatementAnalysis.jsx';
import HomeSpendingSummary from './components/HomeSpendingSummary.jsx';
import useSavedStatement from './hooks/useSavedStatement.js';
import { setTransactionIncluded } from './statements/selection.js';

// App owns the data shared by the panels below. Props pass that data to each panel.
export default function App() {
  // useState remembers a value between renders; its setter updates the screen.
  // Passing the function here creates the starting account on the first render.
  // Navigation changes the visible screen without discarding account data or drafts.
  const [page, setPage] = useState('home');
  const { savedStatement, updateSavedStatement, storageError } = useSavedStatement();
  const [statementKey, setStatementKey] = useState(0);
  const heading = useRef(null);
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

  function navigate(destination) {
    setPage(destination);
    // Move keyboard focus to the screen title after React updates the view.
    requestAnimationFrame(() => heading.current?.focus());
  }

  function selectTransaction(id, included) {
    if (savedStatement) updateSavedStatement(setTransactionIncluded(savedStatement, id, included));
  }

  function clearStatement() {
    updateSavedStatement(null);
    // Recreate the uploader to cancel any in-flight reading and clear its file input.
    setStatementKey((key) => key + 1);
  }

  function reset() {
    // Discard a pending submission before restoring the demo fixture.
    clearTimeout(timer.current);
    timer.current = null;
    setAccount(createInitialAccount());
    clearStatement();
    setPage('home');
    // Remount the panels to clear local inputs and close the demo controls.
    setResetKey((key) => key + 1);
  }
  return (
    <main>
      <header>
        <span className="brand">◈ &nbsp; Adaptive Credit Guard</span>
        <div className="header-actions" key={resetKey}>
          <NavigationMenu page={page} onNavigate={navigate} />
          <ThemeToggle />
          <button className="secondary" onClick={reset}>Reset demo</button>
        </div>
      </header>
      <div className="intro">
        <p className="eyebrow">CAPITAL ONE HACKATHON · SIMULATED ACCOUNT</p>
        <h1 ref={heading} tabIndex={-1}>
          {{ home: 'Emil’s credit card', grace: 'Request Grace', statements: 'Statement analysis' }[page]}
        </h1>
        <p>{{ home: 'See what you owe and what you can do next.', grace: 'Send a written request and follow its progress.', statements: 'See where your money goes.' }[page]}</p>
      </div>
      {storageError && <p className="notice" role="alert">{storageError}</p>}
      <div key={resetKey}>
        {/* Keep screens mounted so navigating home preserves the request and preview. */}
        <div hidden={page !== 'home'}>
          <AccountOverview account={account} />
          <SafeZoneGauge account={account} />
          {savedStatement && <HomeSpendingSummary
            key={`${savedStatement.fileName}-${savedStatement.savedAt}`}
            statement={savedStatement}
            onSelect={selectTransaction}
            onManage={() => navigate('statements')}
            onClear={clearStatement}
          />}
          <DemoControls account={account} updateAccount={updateAccount} />
        </div>
        <div hidden={page !== 'grace'}>
          <button className="secondary back-button" onClick={() => navigate('home')}>← Back to home</button>
          <RequestGrace
            account={account}
            updateAccount={updateAccount}
            timer={timer}
          />
        </div>
        <div hidden={page !== 'statements'}>
          <button className="secondary back-button" onClick={() => navigate('home')}>← Back to home</button>
          <StatementAnalysis key={statementKey}
            savedStatement={savedStatement}
            onSave={updateSavedStatement}
            onSelect={selectTransaction}
            onClear={clearStatement}
            onViewHome={() => navigate('home')}
          />
        </div>
      </div>
      <footer>Hackathon prototype · All account activity is simulated.</footer>
    </main>
  );
}
