import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  initial,
  pence,
  gauge,
  runPayment,
  generateSupportDraft,
  removeCoolingItem,
  SUPPORT_REASONS,
} from './account.js';
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

function Gauge({ account, onPreFillPurchase }) {
  const [purchase, setPurchase] = useState('');
  const { balance, limit, target } = account;
  const current = gauge(balance, limit, target);
  const amount = pence(purchase);
  const projected = gauge(balance + (amount ?? 0), limit, target);

  function prefillCart(val) {
    setPurchase(val);
  }

  return (
    <section className="card">
      <p className="eyebrow">01 / SAFE-ZONE GAUGE & POINT-OF-SALE</p>
      <h2>Understand your balance</h2>
      <p>
        <strong>{money(balance)}</strong> of {money(limit)} used ·{' '}
        {percent(current.percentage)}
      </p>
      <meter
        min="0"
        max="100"
        value={Math.min(100, current.percentage)}
        aria-label="Current credit limit used"
      />
      <p className="badge">{current.label}</p>

      <label>
        What would an online purchase cost (£)?
        <input
          inputMode="decimal"
          placeholder="e.g. 69.99"
          value={purchase}
          onChange={(e) => setPurchase(e.target.value)}
          aria-describedby="projection"
        />
      </label>

      <div className="actions" style={{ marginTop: '8px' }}>
        <button
          type="button"
          className="secondary"
          onClick={() => prefillCart('69.99')}
        >
          ⚡ Test Amazon Cart (£69.99)
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setPurchase('')}
          disabled={!purchase}
        >
          Clear preview
        </button>
      </div>

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
              : `${money(Math.abs(balance + amount - projected.threshold))} ${
                  balance + amount > projected.threshold ? 'above' : 'below'
                } your ${money(projected.threshold)} target.`}
            {balance + amount > limit &&
              ' 🛑 This would exceed your credit limit.'}
          </>
        ) : (
          'Enter an amount or test an online cart to see the projected impact.'
        )}
      </div>
    </section>
  );
}

function ImpulseAndRepayment({ account, update }) {
  const { coolingItems = [], impulseSavings = 0 } = account;

  return (
    <section className="card">
      <p className="eyebrow">02 / ADHD IMPULSE SHIELD & PAYDAY ANCHOR</p>
      <h2>Impulse cooling & repayment</h2>
      <p>
        Items saved by the Chrome Extension for a 30-minute reflection pause.
      </p>

      {impulseSavings > 0 && (
        <div className="savings-badge">
          <span>🎉</span>
          <strong>Total Impulse Money Saved: {money(impulseSavings)}</strong>
        </div>
      )}

      {coolingItems.length === 0 ? (
        <div className="empty-cooling">
          <p>No items in your cooling queue right now.</p>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            When Emil shops online, the extension intercepts checkouts to offer a 30-minute pause.
          </span>
        </div>
      ) : (
        <ul className="history" style={{ marginTop: '10px' }}>
          {coolingItems.map((item) => (
            <li key={item.id} className="cooling-item-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{item.title}</strong>
                <span className="item-price">{money(item.amount)}</span>
              </div>
              <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#475569' }}>
                Saved from <strong>{item.store}</strong> · ⏳ 30-min reflection active
              </p>
              <div className="actions" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="celebrate-btn"
                  onClick={() => update((state) => removeCoolingItem(state, item.id))}
                >
                  ✓ I don't need this (Save {money(item.amount)}!)
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="payday-box" style={{ marginTop: '18px' }}>
        <h3>⚓ Smart Direct Debit & Payday Anchor</h3>
        <p style={{ fontSize: '0.88rem', margin: '4px 0 8px', color: '#334155' }}>
          <strong>Payday:</strong> {account.payday} ·{' '}
          <strong>Direct Debit Scheduled:</strong> {account.directDebitDate}
        </p>
        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
          Direct Debit clears right after your salary lands on the 1st. This eliminates missed-payment defaults before money can be spent.
        </p>
      </div>
    </section>
  );
}

function Support({ account, update, fail, timer }) {
  const { support, draft, minimum, due, cardholder } = account;
  const [reasonKey, setReasonKey] = useState(support.reason || 'unexpected_expense');
  const [affordableInput, setAffordableInput] = useState(String((support.amountAffordable || 1000) / 100));
  const [recoveryDate, setRecoveryDate] = useState(support.recoveryDate || '1 December');
  const [confirmedWarning, setConfirmedWarning] = useState(support.confirmedWarning || false);

  const setStatus = (status) => update({ support: { ...support, status } });

  function handleGenerateDraft(e) {
    e.preventDefault();
    const affordablePence = pence(affordableInput) || 1000;
    const newDraft = generateSupportDraft({
      cardholder,
      reasonKey,
      amountAffordable: affordablePence,
      minimum,
      due,
      recoveryDate,
    });
    update({
      draft: newDraft,
      support: {
        ...support,
        reason: reasonKey,
        amountAffordable: affordablePence,
        recoveryDate,
        status: 'editing',
      },
    });
  }

  function send() {
    if (timer.current !== null || support.status !== 'review') return;
    setStatus('submitting');
    timer.current = setTimeout(() => {
      timer.current = null;
      setStatus(fail ? 'failed' : 'submitted');
    }, 400);
  }

  return (
    <section className="card">
      <p className="eyebrow">03 / ASSISTED SUPPORT DRAFTER</p>
      <h2>Ask for payment support</h2>
      <p>
        Draft an authentic, personal written request. Not a bot—guided prompts with clear credit warnings.
      </p>

      {/* SUCCESS / STATUS NOTIFICATION */}
      <div role="status">
        {support.status === 'submitting' && <p>Sending your request securely…</p>}
        {support.status === 'failed' && (
          <p className="danger-text">We couldn’t send the request. Your draft is ready to retry.</p>
        )}
        {support.status === 'submitted' && (
          <div className="result">
            <strong>✓ Request received · Awaiting lender review</strong>
            <p>Demo reference: <strong>{support.id}</strong></p>
            <p>
              {minimum
                ? `${money(minimum)} remains due on ${due} while your arrangement is processed.`
                : 'Your statement minimum is covered.'}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
              Capital One will reply via secure inbox within 48 business hours.
            </p>
          </div>
        )}
      </div>

      {/* STEP 1: INITIAL STATE */}
      {support.status === 'idle' && (
        <div style={{ marginTop: '12px' }}>
          <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '14px' }}>
            Facing unexpected financial difficulty this month? Answer 3 quick prompts to draft an authentic, compliant request to Capital One without making an anxious phone call.
          </p>
          <button type="button" onClick={() => setStatus('guided')}>
            Start Guided Support Request
          </button>
        </div>
      )}

      {/* STEP 2: GUIDED QUESTIONNAIRE */}
      {support.status === 'guided' && (
        <form onSubmit={handleGenerateDraft} style={{ marginTop: '12px' }}>
          <label>
            1. What caused the difficulty this month?
            <select
              value={reasonKey}
              onChange={(e) => setReasonKey(e.target.value)}
            >
              <option value="unexpected_expense">Essential unexpected repair / emergency cost</option>
              <option value="medical_health">Health or medical circumstance</option>
              <option value="reduced_hours">Temporary reduction in working hours / delayed pay</option>
              <option value="living_costs">Sharp rise in essential household utility bills</option>
            </select>
          </label>

          <label>
            2. How much can you realistically pay right now (£)?
            <input
              type="text"
              inputMode="decimal"
              value={affordableInput}
              onChange={(e) => setAffordableInput(e.target.value)}
              placeholder="10.00"
              required
            />
          </label>

          <label>
            3. When do you expect your finances to recover?
            <input
              type="text"
              value={recoveryDate}
              onChange={(e) => setRecoveryDate(e.target.value)}
              placeholder="e.g. 1 December (next payday)"
              required
            />
          </label>

          <div className="actions" style={{ marginTop: '14px' }}>
            <button type="submit">Draft My Message</button>
            <button
              type="button"
              className="secondary"
              onClick={() => setStatus('idle')}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* STEP 3: EDIT DRAFT WITH SCOR WARNING */}
      {['editing', 'failed'].includes(support.status) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim() && confirmedWarning) setStatus('review');
          }}
          style={{ marginTop: '12px' }}
        >
          <label>
            Review and edit your message in your own words:
            <textarea
              value={draft}
              required
              maxLength={1500}
              rows="7"
              onChange={(e) => update({ draft: e.target.value })}
            />
          </label>

          {/* INTENTIONAL FRICTION & SCOR CREDIT FILE ADVISORY */}
          <div className="scor-warning">
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <div>
              <strong>FCA & Credit Reference Advisory (SCOR Rules):</strong>
              <p style={{ margin: '4px 0 8px', fontSize: '0.8rem', lineHeight: 1.4 }}>
                A formal payment holiday or forbearance arrangement may be registered as a Special Arrangement (Arrangement to Pay) on your credit record under SCOR guidelines. Use this only for genuine emergencies.
              </p>
              <label className="check" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={confirmedWarning}
                  onChange={(e) => setConfirmedWarning(e.target.checked)}
                />{' '}
                I understand the potential credit record impact and want to submit in writing.
              </label>
            </div>
          </div>

          <div className="actions" style={{ marginTop: '12px' }}>
            <button disabled={!draft.trim() || !confirmedWarning}>
              Proceed to Review
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setStatus('guided')}
            >
              Back to Prompts
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: FINAL CONFIRMATION */}
      {support.status === 'review' && (
        <div style={{ marginTop: '12px' }}>
          <h3>Review before sending</h3>
          <blockquote className="draft-preview">{draft}</blockquote>
          <div className="actions">
            <button onClick={send}>Confirm and Send to Lender</button>
            <button className="secondary" onClick={() => setStatus('editing')}>
              Edit Message
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function DemoControls({ account, update, fail, setFail }) {
  return (
    <details className="demo">
      <summary>Presenter demo controls</summary>
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

        <label>
          Credit limit target (%)
          <input
            type="number"
            min="1"
            max="49"
            step="1"
            key={account.target}
            defaultValue={account.target}
            onBlur={(e) => {
              const target = Number(e.target.value);
              if (Number.isInteger(target) && target >= 1 && target <= 49)
                update({ target });
              else e.target.value = account.target;
            }}
          />
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
          type="button"
          className="secondary"
          onClick={() => {
            const mockItem = {
              id: `demo-${Date.now()}`,
              title: 'Smart Fitness Tracker',
              store: 'Amazon UK',
              amount: 5499,
              savedAt: Date.now(),
              expiresAt: Date.now() + 30 * 60 * 1000,
            };
            update((state) => ({
              ...state,
              coolingItems: [mockItem, ...(state.coolingItems || [])],
            }));
          }}
        >
          + Add Mock Amazon Cooling Item (£54.99)
        </button>
      </div>
      <p style={{ marginTop: '8px', fontSize: '0.8rem', color: '#64748b' }}>
        Presenter tools for testing edge cases, skipped payments, and live point-of-sale injections.
      </p>
    </details>
  );
}

function App() {
  const [account, setAccount] = useState(initial);
  const [fail, setFail] = useState({ payment: false, support: false });
  const [resetKey, setResetKey] = useState(0);
  const timer = useRef(null);

  function update(change) {
    setAccount((state) =>
      typeof change === 'function' ? change(state) : { ...state, ...change },
    );
  }

  function reset() {
    clearTimeout(timer.current);
    timer.current = null;
    setAccount(initial());
    setFail({ payment: false, support: false });
    setResetKey((key) => key + 1);
  }

  return (
    <main>
      <header>
        <span className="brand">◈ &nbsp; Capital One · Adaptive Credit Guard</span>
        <button className="secondary" onClick={reset}>
          Reset demo
        </button>
      </header>

      <div className="intro">
        <p className="eyebrow">CAPITAL ONE HACKATHON · MAKING CREDIT ACCESSIBLE</p>
        <h1>Emil’s credit card</h1>
        <p>Real-time overspend prevention, impulse cooling, and accessible written support.</p>
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
        <div aria-live="polite">
          <span>
            {account.adaptive
              ? 'Next action · Pay statement minimum'
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
          <Gauge account={account} />
          <ImpulseAndRepayment account={account} update={update} />
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

      <footer>
        Capital One Hackathon · Designed around Emil’s ADHD & Dyscalculia · All data simulated.
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
