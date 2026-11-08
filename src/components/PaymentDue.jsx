import React, { useImperativeHandle, useRef, useState } from 'react';
import { parsePaymentDue, paymentTiming } from '../paymentDue.js';
import { formatMoney } from '../utils/format.js';
import { formatDate } from '../statements/dates.js';

// These manually entered details track a payment; they never change the balance.
export default function PaymentDue({ payment, today, onSave, storageError, editorRef }) {
  const amountInput = useRef(null);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  function edit() {
    setAmount(payment ? (payment.amount / 100).toFixed(2) : '');
    setDate(payment?.date ?? '');
    setError('');
    setEditing(true);
    requestAnimationFrame(() => amountInput.current?.focus());
  }
  // Request Grace can take the user directly to the existing editor on Home.
  useImperativeHandle(editorRef, () => ({ open: edit }));
  return <section className="card" aria-labelledby="payment-due-title">
    <h2 id="payment-due-title">Payment due</h2>
    <p className="muted">Enter the amount and date from your lender’s statement. Tracking this does not make a payment or change your balance.</p>
    {payment ? <div className="result">
      <strong>{formatMoney(payment.amount)} due {formatDate(payment.date)}</strong>
      <p>{paymentTiming(payment.date, today)}</p>
    </div> : <p>No payment details added.</p>}
    {storageError && <p role="alert" className="notice">{storageError}</p>}
    {!editing ? <div className="actions">
      <button className="secondary" onClick={edit}>{payment ? 'Edit payment details' : 'Add payment details'}</button>
      {payment && <button className="secondary" onClick={() => onSave(null)}>Clear payment details</button>}
    </div> : <form onSubmit={event => {
      event.preventDefault();
      const next = parsePaymentDue(amount, date);
      if (!next) { setError('Enter an amount above £0 with up to two decimal places and a valid due date.'); return; }
      onSave(next);
      setEditing(false);
    }}>
      <label>Amount due (£)<input ref={amountInput} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} required /></label>
      <label>Payment due date<input type="date" min="1000-01-01" max="9999-12-31" value={date} onChange={event => setDate(event.target.value)} required /></label>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <button>Save payment details</button>
        <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </form>}
  </section>;
}
