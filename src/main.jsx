import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { initial, pence, gauge, runPayment } from './account.js';
import './style.css';

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});
const money = (amount) => gbp.format(amount / 100);
const percent = (amount) =>
  new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(amount) +
  '%';

function Gauge({ account, update }) {
  // A what-if purchase stays local to the preview and never changes the ledger.
  const [purchase, setPurchase] = useState('');
  const { balance, limit, target } = account;
  const current = gauge(balance, limit, target);
  const amount = pence(purchase);
  const projected = gauge(balance + (amount ?? 0), limit, target);
  const previewing = purchase !== '' && amount !== null;
  const displayed = previewing ? projected : current;
  const displayedBalance = previewing ? balance + amount : balance;
  return (
    <section className="card">
      <p className="eyebrow">01 / SAFE-ZONE GAUGE</p>
      <h2>Understand your balance</h2>
      <p>
        {previewing ? 'Projected balance: ' : 'Current balance: '}
        <strong>{money(displayedBalance)}</strong> of {money(limit)} used ·{' '}
        {percent(displayed.percentage)}
      </p>
      {previewing && <p>Current balance: {money(balance)}</p>}
      <div
        className={`gauge ${displayed.zone}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, displayed.percentage)}
        aria-valuetext={`${percent(displayed.percentage)} used. ${displayed.label}${displayedBalance > limit ? '. This would exceed your credit limit.' : ''}`}
        aria-label={previewing ? 'Projected credit limit used' : 'Current credit limit used'}
      >
        <span style={{ width: `${Math.min(100, displayed.percentage)}%` }} />
      </div>
      <p className={`badge ${displayed.zone}`}>{displayed.label}</p>
      <label className="target-control">
        Credit limit target (%) · {target}% ({money(current.threshold)})
        <input
          type="range"
          min="1"
          max="49"
          value={target}
          onChange={(event) => update({ target: Number(event.target.value) })}
          aria-describedby="target-hint"
        />
      </label>
      <p id="target-hint" className="hint">Amber starts at your target; red starts at 50%. This is a planning aid, not a credit-score prediction.</p>
      <label>
        What would a purchase cost (£)?
        <input
          inputMode="decimal"
          value={purchase}
          onChange={(e) => setPurchase(e.target.value)}
          aria-describedby="projection"
          aria-invalid={purchase !== '' && amount === null}
        />
      </label>
      <p className="hint">Preview only. Your actual balance stays the same.</p>
      <button
        className="secondary"
        onClick={() => setPurchase('')}
        disabled={!purchase}
      >
        Clear preview
      </button>
      <div id="projection" className="result" role="status">
        {purchase && amount === null ? (
          'Enter pounds with up to two decimal places.'
        ) : purchase ? (
          <>
            <strong>
              {money(balance + amount)} of {money(limit)} (
              {percent(projected.percentage)})
            </strong>
            <br />
            {projected.label}.{' '}
            {balance + amount === projected.threshold
              ? `Exactly at your ${money(projected.threshold)} target.`
              : `${money(Math.abs(balance + amount - projected.threshold))} ${balance + amount > projected.threshold ? 'above' : 'below'} your ${money(projected.threshold)} target.`}
            {balance + amount > limit &&
              ' This would exceed your credit limit.'}
          </>
        ) : (
          'Enter an amount to see a what-if preview.'
        )}
      </div>
    </section>
  );
}

function Payments({ account, update, fail }) {
  const [buffer, setBuffer] = useState(String(account.buffer / 100));
  // A posted, skipped or failed check consumes the current simulated week.
  const attempted = account.payments.some((item) => item.week === account.week);
  const remaining = account.minimum
    ? `${money(account.minimum)} is still due on ${account.due}.`
    : 'Your statement minimum is covered.';
  return (
    <section className="card">
      <p className="eyebrow">02 / MICRO-SETTLEMENT</p>
      <h2>Set a weekly payment</h2>
      <p>
        Pay up to £10 each simulated week when it leaves enough money in your
        bank account.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const amount = pence(buffer);
          if (amount !== null) update({ buffer: amount, plan: 'active' });
        }}
      >
        <label>
          Keep at least this much in my bank (£)
          <input
            required
            inputMode="decimal"
            pattern={'([0-9]{1,7}(\\.[0-9]{0,2})?|\\.[0-9]{1,2})'}
            value={buffer}
            onChange={(e) => setBuffer(e.target.value)}
          />
        </label>
        <div className="actions">
          <button>
            {account.plan === 'active'
              ? 'Save buffer'
              : account.plan === 'paused'
                ? 'Resume plan'
                : 'Start weekly plan'}
          </button>
          {account.plan === 'active' && (
            <button
              type="button"
              className="secondary"
              onClick={() => update({ plan: 'paused' })}
            >
              Pause
            </button>
          )}
          {account.plan !== 'off' && (
            <button
              type="button"
              className="secondary"
              onClick={() => update({ plan: 'off' })}
            >
              Cancel plan
            </button>
          )}
        </div>
      </form>
      <div className="result" role="status">
        <strong>
          {account.plan === 'active'
            ? `Active · ${money(account.buffer)} cash buffer`
            : account.plan === 'paused'
              ? 'Plan paused'
              : 'Plan off'}
        </strong>
        <p>
          {attempted
            ? `Week ${account.week} checked`
            : account.plan === 'active'
              ? `Payment scheduled for demo week ${account.week}`
              : 'No payment scheduled'}
        </p>
        {account.payments[0] && <p>{remaining}</p>}
      </div>
      <button
        className="secondary"
        disabled={account.plan !== 'active' || attempted}
        onClick={() => update((state) => runPayment(state, fail))}
      >
        Run scheduled check
      </button>
      {account.payments.length > 0 && (
        <ul className="history">
          {account.payments.map((item) => (
            <li key={item.week}>
              <strong>
                Week {item.week} · {item.status}
              </strong>{' '}
              {money(item.amount)}. {item.reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Support({ account, update, fail, timer }) {
  const { support, draft } = account;
  const setStatus = (status) => update({ support: { ...support, status } });
  function send() {
    // Set the timer immediately to guard against duplicate confirmation clicks.
    if (timer.current !== null || support.status !== 'review') return;
    setStatus('submitting');
    timer.current = setTimeout(() => {
      timer.current = null;
      // The message lives separately, so a failed send preserves the edited draft.
      setStatus(fail ? 'failed' : 'submitted');
    }, 350);
  }
  return (
    <section className="card">
      <p className="eyebrow">03 / SILENT GRACE</p>
      <h2>Ask for payment support</h2>
      <p>Send a written request and follow its status here. Your payment remains due until the lender confirms an arrangement.</p>
      <div role="status">
        {support.status === 'submitting' && <p>Sending your request…</p>}
        {support.status === 'failed' && (
          <p>We couldn’t send the request. Your draft is ready to retry.</p>
        )}
        {support.status === 'submitted' && (
          <div className="result">
            <strong>Request received · awaiting review</strong>
            <p>Demo reference {support.id}</p>
            <p>
              {account.minimum
                ? `${money(account.minimum)} is still due on ${account.due}.`
                : 'Your statement minimum is covered.'}
            </p>
          </div>
        )}
      </div>
      {support.status === 'draft' && (
        <button onClick={() => setStatus('editing')}>
          Ask for payment support
        </button>
      )}
      {['editing', 'failed'].includes(support.status) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) setStatus('review');
          }}
        >
          <label>
            Message to the lender
            <textarea
              value={draft}
              required
              maxLength={1500}
              rows="5"
              onChange={(e) => update({ draft: e.target.value })}
            />
          </label>
          <div className="actions">
            <button disabled={!draft.trim()}>Review message</button>
            <button type="button" className="secondary" onClick={() => setStatus('draft')}>Cancel</button>
          </div>
        </form>
      )}
      {support.status === 'review' && (
        <>
          <h3>Review your message</h3>
          <blockquote>{draft}</blockquote>
          <div className="actions">
            <button onClick={send}>Confirm and send</button>
            <button className="secondary" onClick={() => setStatus('editing')}>
              Edit message
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// Presenter-only controls advance the scheduler without changing the statement date.
function DemoControls({ account, update, fail, setFail }) {
  return (
    <details className="demo">
      <summary>Demo controls</summary>
      <div className="controls">
        <label>
          Available bank balance (£)
          <input
            type="number"
            min="0"
            max="9999999"
            step="0.01"
            key={account.bank}
            defaultValue={(account.bank / 100).toFixed(2)}
            onBlur={(e) => {
              const bank = pence(e.target.value);
              if (bank !== null) update({ bank });
              else e.target.value = (account.bank / 100).toFixed(2);
            }}
          />
        </label>
        <label>
          Balance data
          <select
            value={account.freshness}
            onChange={(e) => update({ freshness: e.target.value })}
          >
            <option value="fresh">Fresh</option>
            <option value="stale">Stale</option>
            <option value="missing">Unavailable</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={fail.payment}
            onChange={(e) => setFail({ ...fail, payment: e.target.checked })}
          />{' '}
          Fail payment service
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={fail.support}
            onChange={(e) => setFail({ ...fail, support: e.target.checked })}
          />{' '}
          Fail support submission
        </label>
        <button
          className="secondary"
          onClick={() =>
            update((state) => ({ ...state, week: state.week + 1 }))
          }
        >
          Advance to next demo week
        </button>
      </div>
      <p>
        Demo week {account.week}. The simulator tracks one statement and keeps
        its due date fixed.
      </p>
    </details>
  );
}

function App() {
  const [account, setAccount] = useState(initial);
  const [fail, setFail] = useState({ payment: false, support: false });
  const [resetKey, setResetKey] = useState(0);
  const timer = useRef(null);
  // Payment checks use the latest state, including any check already queued.
  function update(change) {
    setAccount((state) =>
      typeof change === 'function' ? change(state) : { ...state, ...change },
    );
  }
  function reset() {
    // Discard a pending submission before restoring the demo fixture.
    clearTimeout(timer.current);
    timer.current = null;
    setAccount(initial());
    setFail({ payment: false, support: false });
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
        <h1>Alex’s credit card</h1>
        <p>See what you owe and what you can do next.</p>
        <label className="check mode">
          <input
            type="checkbox"
            checked={account.adaptive}
            onChange={(e) => update({ adaptive: e.target.checked })}
          />{' '}
          Adaptive Mode
        </label>
      </div>
      <section className="overview" aria-label="Account overview">
        <div>
          <span>Current balance</span>
          <strong>{money(account.balance)}</strong>
        </div>
        <div>
          <span>Credit limit</span>
          <strong>{money(account.limit)}</strong>
        </div>
        <div>
          <span>Available credit</span>
          <strong>{money(Math.max(0, account.limit - account.balance))}</strong>
        </div>
        <div aria-live="polite">
          <span>
            {account.adaptive && account.minimum > 0
              ? 'Next action · pay your remaining minimum'
              : 'Remaining statement minimum'}
          </span>
          <strong>{money(account.minimum)}</strong>
          <span>
            {account.minimum ? 'Due ' + account.due : 'Minimum covered'}
          </span>
        </div>
      </section>
      <div key={resetKey}>
        <div className="grid" hidden={!account.adaptive}>
          <Gauge account={account} update={update} />
          <Payments account={account} update={update} fail={fail.payment} />
          <Support
            account={account}
            update={update}
            fail={fail.support}
            timer={timer}
          />
        </div>
        <DemoControls
          account={account}
          update={update}
          fail={fail}
          setFail={setFail}
        />
      </div>
      <footer>Hackathon prototype · All account activity is simulated.</footer>
    </main>
  );
}
createRoot(document.getElementById('root')).render(<App />);
