import React from 'react';

// Flow: draft → editing → review → submitting → submitted (or failed → review).
// App supplies the account, an update function, a failure switch and a shared timer.
export default function SilentGrace({ account, updateAccount, fail, timer }) {
  const { support, draft } = account;
  // Keep the existing reference ID while replacing only the request status.
  const setStatus = (status) => updateAccount({ support: { ...support, status } });
  function send() {
    // Set the timer immediately to guard against duplicate confirmation clicks.
    if (timer.current !== null || support.status !== 'review') return;
    setStatus('submitting');
    // Simulate a short network delay. This demo does not contact a real lender.
    timer.current = setTimeout(() => {
      timer.current = null;
      // The message lives separately, so a failed send preserves the edited draft.
      setStatus(fail ? 'failed' : 'submitted');
    }, 350);
  }
  return (
    <section className="card">
      <p className="eyebrow">02 / SILENT GRACE</p>
      <h2>Ask for payment support</h2>
      <p>Send a written request and follow its status here.</p>
      {/* Announce progress and results to screen readers when the status changes. */}
      <div role="status">
        {support.status === 'submitting' && <p>Sending your request…</p>}
        {support.status === 'failed' && (
          <p>We couldn’t send the request. Your draft is ready to retry.</p>
        )}
        {support.status === 'submitted' && (
          <div className="result">
            <strong>Request received · awaiting review</strong>
            <p>Demo reference {support.id}</p>
          </div>
        )}
      </div>
      {support.status === 'draft' && (
        <button onClick={() => setStatus('editing')}>
          Ask for payment support
        </button>
      )}
      {/* Reuse the editor after a failure so the user can retry their saved draft. */}
      {['editing', 'failed'].includes(support.status) && (
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

