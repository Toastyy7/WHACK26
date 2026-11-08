import React, { useEffect, useRef, useState } from 'react';
import { focusSummary } from '../focus.js';
import { formatMoney } from '../utils/format.js';
import { paymentTiming } from '../paymentDue.js';
import { formatDate } from '../statements/dates.js';

// Native modal keeps the background inactive and keyboard focus inside the popup.
export default function FocusMode({ payment, today, account, transactions, month, onReview, onTryPurchase }) {
  const dialog = useRef(null);
  const content = useRef(null);
  const [step, setStep] = useState(-1);
  const [breathing, setBreathing] = useState(false);
  const [breatheIn, setBreatheIn] = useState(true);
  // The guide runs only while requested on the welcome screen. Closing, changing
  // steps or resetting unmounts/stops the timer; the summary never advances itself.
  useEffect(() => {
    if (!breathing || step !== -1) return;
    const timer = setInterval(() => setBreatheIn(value => !value), 4000);
    return () => clearInterval(timer);
  }, [breathing, step]);
  function stopBreathing() { setBreathing(false); setBreatheIn(true); }
  function showSummary() { stopBreathing(); setStep(0); }
  const summary = focusSummary(account, transactions, month);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  useEffect(() => {
    if (dialog.current?.open) content.current?.focus();
  }, [step]);

  // Keep Tab on a usable control at either end of the modal, including when
  // the newly focused fact (tabIndex -1) is the starting point.
  function trapTab(event) {
    if (event.key !== 'Tab') return;
    const buttons = [...dialog.current.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === content.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
  function close() { stopBreathing(); dialog.current.close(); }
  function open() {
    stopBreathing();
    setStep(-1);
    dialog.current.showModal();
    content.current?.focus();
  }
  function act(callback) {
    close();
    callback();
  }
  const facts = [
    { title: 'What you owe', value: formatMoney(summary.owed), text: 'This is the current amount owed on your demo credit card.' },
    { title: 'Safe to spend', value: formatMoney(summary.safeToSpend), text: `${summary.label}. This is what remains within your chosen safe limit. It does not account for other bills or income.` },
    { title: 'Recorded spending this month', value: summary.count ? formatMoney(summary.spending) : 'No transactions recorded', text: `${monthLabel}. Only selected transactions dated this month are included. Your records may not show all your spending.` },
    { title: 'Largest recorded category', value: summary.topCategory?.category ?? 'No category to show yet', text: summary.topCategory ? `${formatMoney(summary.topCategory.amount)} recorded this month, including any transfers or cash assigned to this category. You can check the entries if that would help.` : 'You can add or review transactions whenever you are ready.' },
  ];
  if (payment) facts.splice(1, 0, {
    title: 'Payment due', value: formatMoney(payment.amount),
    text: `${formatDate(payment.date)}. ${paymentTiming(payment.date, today)}. These are your manually entered payment details.`,
  });
  const fact = facts[step];
  return <>
    <section className="focus-entry" aria-label="Focus mode">
      <div><h2>One thing at a time</h2><p>See a simpler view, at your own pace.</p></div>
      <button onClick={open}>Focus mode</button>
    </section>
    <dialog ref={dialog} className="focus-dialog" onKeyDown={trapTab} onCancel={stopBreathing} onClose={stopBreathing} aria-labelledby="focus-title">
      <div className="focus-top"><span>Focus mode{step >= 0 ? ` · ${step + 1} of ${facts.length + 1}` : ''}</span><button className="secondary" onClick={close}>Close focus mode</button></div>
      {/* Focus the new fact once, rather than announcing the whole dialog repeatedly. */}
      <div ref={content} tabIndex={-1} className="focus-content">
        <p className="muted">One thing at a time. You can stop here.</p>
        <h2 id="focus-title">{step === -1 ? 'Take a breather.' : fact?.title ?? 'What would help next?'}</h2>
        {step === -1 ? <>
          <p>There’s no rush. When you’re ready, we’ll look at one thing at a time.</p>
          <div className="breathing-guide">
            <div className="breathing-space" aria-hidden="true">
              <div className={`breathing-circle${breathing ? ' is-breathing' : ''}`} />
            </div>
            <p className="breathing-label" role="status">{breathing ? (breatheIn ? 'Breathe in' : 'Breathe out') : 'Breathe at your own pace.'}</p>
            <p className="muted">Follow the guide only if it feels comfortable. You can stop or skip it anytime.</p>
            <button className="secondary" onClick={() => {
              if (breathing) stopBreathing();
              else { setBreatheIn(true); setBreathing(true); }
            }}>{breathing ? 'Pause breathing guide' : 'Start breathing guide'}</button>
          </div>
          <button onClick={showSummary}>Show my summary</button>
        </> : fact ? <><p className="focus-value">{fact.value}</p><p>{fact.text}</p></> : <>
          <p>Choose one if it feels useful. You do not need to decide now.</p>
          <div className="focus-options">
            <button onClick={() => act(onReview)}>Review recorded spending</button>
            <button className="secondary" onClick={() => act(onTryPurchase)}>Try a purchase amount</button>
            <button className="secondary" onClick={close}>Finish for now</button>
          </div>
        </>}
      </div>
      {step >= 0 && <div className="focus-navigation">
        <button className="secondary" onClick={() => setStep(value => value - 1)}>Back</button>
        {step < facts.length && <button onClick={() => setStep(value => value + 1)}>Next</button>}
      </div>}
    </dialog>
  </>;
}
