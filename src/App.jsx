import React, { useState, useRef, useLayoutEffect } from 'react';
import { createInitialAccount, getGaugeState } from './account.js';
import AccountOverview from './components/AccountOverview.jsx';
import FocusMode from './components/FocusMode.jsx';
import PaymentDue from './components/PaymentDue.jsx';
import usePaymentDue from './hooks/usePaymentDue.js';
import { localDay } from './paymentDue.js';
import { advanceGraceRequest } from './grace.js';
import SafeZoneGauge from './components/SafeZoneGauge.jsx';
import ImpulseCoolingQueue from './components/ImpulseCoolingQueue.jsx';
import RequestGrace from './components/RequestGrace.jsx';
import DemoControls from './components/DemoControls.jsx';
import NavigationMenu from './components/NavigationMenu.jsx';
import SettingsMenu from './components/SettingsMenu.jsx';
import { loadDisplayPreferences, saveDisplayPreferences, effectiveDisplayPreferences } from './preferences.js';
import StatementAnalysis from './components/StatementAnalysis.jsx';
import HomeSpendingSummary from './components/HomeSpendingSummary.jsx';
import useSavedStatement from './hooks/useSavedStatement.js';
import { setTransactionIncluded } from './statements/selection.js';
import { monthlyBalance } from './statements/monthlyBalance.js';
import useCurrentMonth from './hooks/useCurrentMonth.js';
import useCoolingQueue from './hooks/useCoolingQueue.js';
import useExtensionBridge, { resetExtension } from './hooks/useExtensionBridge.js';

// App owns the data shared by the panels below. Props pass that data to each panel.
// `session` comes from AccountGate: the signed-in user (or null for a guest), their own
// browser storage, and log-in/log-out actions. Without it the app runs as a guest.
export default function App({ session = {} }) {
  // useState remembers a value between renders; its setter updates the screen.
  // Passing the function here creates the starting account on the first render.
  // Navigation changes the visible screen without discarding account data or drafts.
  const [page, setPage] = useState('home');
  // Like the theme, these display choices are kept across Reset demo.
  const [preferences, setPreferences] = useState(() => {
    try { return loadDisplayPreferences(localStorage, window.matchMedia('(prefers-color-scheme: dark)').matches); }
    catch { return loadDisplayPreferences(null); }
  });
  const [storageSaved, setStorageSaved] = useState(true);
  const display = effectiveDisplayPreferences(preferences);
  const { view, font } = display;
  useLayoutEffect(() => {
    for (const [key, value] of Object.entries(effectiveDisplayPreferences(preferences))) document.documentElement.dataset[key] = String(value);
    try { setStorageSaved(saveDisplayPreferences(localStorage, preferences)); }
    catch { setStorageSaved(false); }
  }, [preferences]);
  const { savedStatement, updateSavedStatement, receivePurchase, storageError } = useSavedStatement(session.storage);
  const { queue, addCoolingItem, dismissCoolingItem, resetCoolingQueue, coolingError } = useCoolingQueue(session.storage);
  const [statementKey, setStatementKey] = useState(0);
  const heading = useRef(null);
  const purchasePanel = useRef(null);
  const [account, setAccount] = useState(createInitialAccount);
  // The signed-in person's name in titles ("Sam"); guests get "you" wording.
  const name = session.user ? session.user.username.charAt(0).toUpperCase() + session.user.username.slice(1) : null;
  const month = useCurrentMonth();
  const { payment, updatePayment, today, paymentError } = usePaymentDue(session.storage);
  const adjustment = monthlyBalance(account.balance, savedStatement?.result.transactions ?? [], month);
  const displayedAccount = { ...account, balance: adjustment.balance };
  // One money model: the extension gets the safe limit and what is owed, so both
  // sides show the same "safe to spend" (safe limit − owed).
  const extensionConnection = useExtensionBridge({
    monthlyBudget: getGaugeState(displayedAccount.balance, account.limit, account.target).threshold,
    currentSpent: displayedAccount.balance,
    receivePurchase,
    receiveCoolingItem: addCoolingItem,
    font,
    displayPreferences: display,
    cardLimit: account.limit,
  });
  // Changing this key tells React to recreate the panels and clear their local state.
  const [resetKey, setResetKey] = useState(0);
  // useRef keeps the pending timeout ID without causing a render when it changes.
  // Keeping it here lets Reset cancel a submission started in RequestGrace.
  const timer = useRef(null);
  const graceDecisionMade = useRef(false);
  const paymentEditor = useRef(null);

  function advanceGrace() {
    // Guard synchronously too: two clicks before React renders must not reroll a
    // decision or extend the same payment twice. Keep side effects out of setters.
    if (graceDecisionMade.current) return;
    const next = advanceGraceRequest(account.support, payment, localDay());
    if (next.support === account.support) return;
    if (['accepted', 'declined'].includes(next.support.status)) graceDecisionMade.current = true;
    setAccount(state => ({ ...state, support: next.support }));
    if (next.payment !== payment) updatePayment(next.payment);
  }

  function addPaymentDetails() {
    navigate('home');
    paymentEditor.current?.open();
  }

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
    graceDecisionMade.current = false;
    setAccount(createInitialAccount());
    resetCoolingQueue();
    updatePayment(null);
    resetExtension();
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
          <SettingsMenu preferences={preferences} onChange={setPreferences} storageSaved={storageSaved} />
          <button className="secondary" onClick={reset}>Reset demo</button>
          {session.user ? (<>
            <span className="account-chip">Signed in as <strong>{session.user.username}</strong></span>
            <button className="secondary" onClick={session.onLogOut}>Log out</button>
          </>) : session.onLogIn && (<>
            <span className="account-chip">{session.offline ? 'Guest (accounts offline)' : 'Guest'}</span>
            {!session.offline && <button className="secondary" onClick={session.onLogIn}>Log in</button>}
          </>)}
        </div>
      </header>
      <div className="intro">
        <p className="eyebrow">CAPITAL ONE HACKATHON · SIMULATED ACCOUNT</p>
        <h1 ref={heading} tabIndex={-1}>
          {{ home: name ? `${name}’s credit card` : 'Your credit card', grace: 'Request Grace', statements: 'Statement analysis' }[page]}
        </h1>
        <p>{{ home: 'See what you owe and what you can do next.', grace: 'Send a written request and follow its progress.', statements: 'See where your money goes.' }[page]}</p>
      </div>
      <p className="extension-connection" role="status">
        {extensionConnection === 'connected' ? 'Extension connected · balance is synced'
          : extensionConnection === 'connecting' ? 'Checking extension connection…'
            : 'Extension not connected. Reload CheckoutGuard, allow it on this site, then refresh this tab. Use the same Chrome or Firefox profile for shopping.'}
      </p>
      {storageError && <p className="notice" role="alert">{storageError}</p>}
      {coolingError && <p className="notice" role="alert">{coolingError}</p>}
      <div key={resetKey}>
        {/* Keep screens mounted so navigating home preserves the request and preview. */}
        <div hidden={page !== 'home'}>
          <FocusMode payment={payment} today={today} account={displayedAccount} transactions={savedStatement?.result.transactions ?? []} month={month}
            onReview={() => navigate('statements')}
            onTryPurchase={() => { purchasePanel.current?.scrollIntoView({ block: 'center' }); purchasePanel.current?.querySelector('input')?.focus(); }} />
          <AccountOverview account={displayedAccount} detailed={view === 'detailed'} monthlyOutgoing={adjustment.outgoing} balanceFigure={display.balanceFigure} />
          <PaymentDue payment={payment} today={today} onSave={updatePayment} storageError={paymentError} editorRef={paymentEditor} />
          <div ref={purchasePanel}><SafeZoneGauge account={displayedAccount} balanceFigure={display.balanceFigure} /></div>
          <ImpulseCoolingQueue
            items={queue.items}
            savings={queue.savings}
            onDismiss={dismissCoolingItem}
            onAddSimulated={addCoolingItem}
            name={name}
          />
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
            onAdvance={advanceGrace}
            payment={payment}
            paymentError={paymentError}
            onAddPaymentDetails={addPaymentDetails}
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
