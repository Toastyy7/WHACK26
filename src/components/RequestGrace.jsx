import React, { useRef, useState } from 'react';
import { formatDate } from '../statements/dates.js';

// Flow: draft → editing → review → submitting → submitted → reviewing → accepted/declined.
// App supplies the account, an update function and a shared timer.
export default function RequestGrace({ account, updateAccount, timer, onAdvance, payment, paymentError, onAddPaymentDetails }) {
  const { support, draft } = account;
  // Native dialog supplies modal focus handling and Escape-to-close behaviour.
  const disclaimer = useRef(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Keep the existing reference ID while replacing only the request status.
  const setStatus = (status) => updateAccount({ support: { ...support, status } });
  function send() {
    // Set the timer immediately to guard against duplicate confirmation clicks.
    if (timer.current !== null || support.status !== 'review' || !termsAccepted) return;
    disclaimer.current.close();
    setStatus('submitting');
    // Simulate a short network delay. This demo does not contact a real lender.
    timer.current = setTimeout(() => {
      timer.current = null;
      setStatus('submitted');
    }, 350);
  }
  return (
    <section className="card">
      <p className="eyebrow">03 / REQUEST GRACE</p>
      <h2>Request Grace</h2>
      <p>Send a written request and follow its status here.</p>
      {/* Announce progress and results to screen readers when the status changes. */}
      <div role="status">
        {support.status === 'submitting' && <p>Sending your request…</p>}
        {['submitted', 'reviewing', 'accepted', 'declined'].includes(support.status) && (
          <div className="result">
            <strong>
              {support.status === 'submitted' && 'Request received · awaiting review'}
              {support.status === 'reviewing' && 'Your request is being reviewed'}
              {support.status === 'accepted' && 'Grace request accepted · simulated decision'}
              {support.status === 'declined' && 'Grace request declined · simulated decision'}
            </strong>
            <p>Demo reference {support.id}</p>
            {support.status === 'accepted' && (
              <>
                {support.paymentDate ? <p>Payment due date moved to {formatDate(support.paymentDate)} (14-day demo extension).</p>
                  : !payment ? <>
                    <p>Add payment details to track a due date. No payment date has been changed.</p>
                    <button className="secondary" onClick={onAddPaymentDetails}>Add payment details</button>
                  </> : <p>No payment date was changed. You can edit your payment details on Home.</p>}
                {paymentError && <p className="notice" role="alert">{paymentError}</p>}
                <p>In a real service, the lender would confirm the arrangement and its terms in writing.</p>
              </>
            )}
            {support.status === 'declined' && (
              <p>You can contact your lender to discuss other support options.</p>
            )}
          </div>
        )}
      </div>
      {/* Each click advances the demo once; terminal decisions cannot be rerolled. */}
      {['submitted', 'reviewing'].includes(support.status) && (
        <button className="secondary" onClick={onAdvance}>
          Update request status
        </button>
      )}
      {['accepted', 'declined'].includes(support.status) && (
        <p>Demo decision chosen at random; it does not predict a lender’s decision.</p>
      )}
      {support.status === 'draft' && (
        <><p>If accepted in this demo, Grace moves your saved payment date 14 days beyond today or the current due date, whichever is later. The amount due stays the same.</p>
        <button onClick={() => setStatus('editing')}>
          Request Grace
        </button></>
      )}
      {support.status === 'editing' && (
        <form
          onSubmit={(e) => {
            // Handle the form in React instead of letting the browser reload the page.
            e.preventDefault();
            // trim() prevents a message containing only spaces from being reviewed.
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
              onChange={(e) => updateAccount({ draft: e.target.value })}
            />
          </label>
          <button disabled={!draft.trim()}>Review message</button>
        </form>
      )}
      {/* Sending requires a separate confirmation after the user reviews the message. */}
      {support.status === 'review' && (
        <>
          <h3>Review your message</h3>
          <blockquote>{draft}</blockquote>
          <div className="scor-review-note" style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--soft)', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.85rem' }}>
            <span>⚠️</span>
            <span>Formal forbearance requests carry potential credit file implications. Review the advisory before sending.</span>
          </div>
          <div className="actions">
            <button onClick={() => {
              setTermsAccepted(false);
              disclaimer.current.showModal();
            }}>Continue to regulatory disclaimer</button>
            <button className="secondary" onClick={() => setStatus('editing')}>
              Edit message
            </button>
          </div>
        </>
      )}
      <dialog ref={disclaimer} aria-labelledby="grace-disclaimer-title" style={{ maxWidth: '540px', padding: '24px', borderRadius: '14px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)' }}>
        <h3 id="grace-disclaimer-title">Before you request grace</h3>
        <p>Grace requests are not automatic. The lender will assess the support available for your circumstances.</p>

        <div className="scor-advisory" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px', margin: '14px 0', color: '#92400e' }} role="note">
          <h4 style={{ margin: '0 0 6px 0', color: '#78350f' }}>⚠️ SCOR credit-file advisory</h4>
          <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', lineHeight: 1.4 }}>
            Contacting your lender to ask for help does not itself affect your credit file. If you agree a reduced-payment, payment-pause or other support arrangement, the lender may report that arrangement to credit reference agencies.
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.4 }}>
            FCA guidance says the lender should explain how any option affects interest, fees, your balance and credit-file reporting before you agree it. A reported arrangement can affect future borrowing decisions, but missing payments can also be reported.
          </p>
        </div>

        <h4>Terms of request</h4>
        <ul>
          <li>Sending a request does not change your existing payment obligations until agreed.</li>
          <li>Any arrangement only starts when the lender confirms its terms.</li>
          <li>Interest or charges may continue unless the lender agrees to reduce, waive or suspend them.</li>
        </ul>
        <label className="check" style={{ fontWeight: 650, marginTop: '14px' }}>
          <input type="checkbox" checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)} />
          I understand that an agreed support arrangement may be reported on my credit file and wish to submit this request in writing.
        </label>
        <div className="actions" style={{ marginTop: '16px' }}>
          <button disabled={!termsAccepted} onClick={send}>Confirm and send</button>
          <button className="secondary" onClick={() => disclaimer.current.close()}>Go back</button>
        </div>
      </dialog>
    </section>
  );
}

