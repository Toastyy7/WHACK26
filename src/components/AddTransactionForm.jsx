import React, { useState } from 'react';
import { categories } from '../statements/categories.js';
import { createManualTransaction } from '../statements/manualTransactions.js';

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AddTransactionForm({ onAdd, disabled }) {
  const [category, setCategory] = useState(categories[0]);
  const [price, setPrice] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      // A distinct ID lets identical purchases be selected independently.
      const transaction = createManualTransaction({ category, price, merchant, date }, `manual-${crypto.randomUUID()}`);
      onAdd(transaction);
      setPrice('');
      setMerchant('');
      setMessage('Transaction added to Home and spending totals.');
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <form className="add-transaction" onSubmit={submit}>
      <h3>Add a transaction</h3>
      <p>Add an outgoing payment, with or without uploading a statement.</p>
      <fieldset disabled={disabled}>
        <legend className="sr-only">Transaction details</legend>
        <div className="transaction-form-fields">
          <label>Type / category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>Price (£)
            <input required type="number" inputMode="decimal" min="0.01" max="9999999.99" step="0.01"
              value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>
          <label>Where from / merchant
            <input required maxLength={200} value={merchant} onChange={(event) => setMerchant(event.target.value)} />
          </label>
          <label>Date
            <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>
        <button type="submit">Add transaction</button>
      </fieldset>
      {error && <p className="notice" role="alert">{error}</p>}
      <p role="status">{message}</p>
    </form>
  );
}
