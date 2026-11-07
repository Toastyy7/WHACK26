import React, { useRef, useState } from 'react';
import { advanceGraceStatus } from '../grace.js';

// Flow: draft → editing → review → submitting → submitted → reviewing → accepted/declined.
// App supplies the account, an update function and a shared timer.
export default function RequestGrace({ account, updateAccount, timer }) {
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
      <p className="eyebrow">02 / REQUEST GRACE</p>
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
              <p>In a real service, the lender would confirm the arrangement and its terms in writing.</p>
            )}
            {support.status === 'declined' && (
              <p>You can contact your lender to discuss other support options.</p>
            )}
          </div>
        )}
      </div>
      {/* Each click advances the demo once; terminal decisions cannot be rerolled. */}
      {['submitted', 'reviewing'].includes(support.status) && (
        <button className="secondary" onClick={() => setStatus(advanceGraceStatus(support.status))}>
          Update request status
        </button>
      )}
      {['accepted', 'declined'].includes(support.status) && (
        <p>Demo decision chosen at random; it does not predict a lender’s decision.</p>
      )}
      {support.status === 'draft' && (
        <button onClick={() => setStatus('editing')}>
          Request Grace
        </button>
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
          <div className="actions">
            <button onClick={() => {
              setTermsAccepted(false);
              disclaimer.current.showModal();
            }}>Continue to disclaimer</button>
            <button className="secondary" onClick={() => setStatus('editing')}>
              Edit message
            </button>
          </div>
        </>
      )}
      <dialog ref={disclaimer} aria-labelledby="grace-disclaimer-title">
        <h3 id="grace-disclaimer-title">Before you request grace</h3>
        <p>Grace requests are not always accepted. Each request needs a lender decision.</p>
        <h4>Simple terms</h4>
        <ul>
          <li>Sending a request does not change your existing payment obligations.</li>
          <li>Any arrangement only starts when your lender confirms its terms.</li>
          <li>This is a demo: no request is sent and decisions are random.</li>
        </ul>
        <label className="check">
          <input type="checkbox" checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)} />
          I understand these terms.
        </label>
        <div className="actions">
          <button disabled={!termsAccepted} onClick={send}>Confirm and send</button>
          <button className="secondary" onClick={() => disclaimer.current.close()}>Go back</button>
        </div>
      </dialog>
    </section>
  );
}

