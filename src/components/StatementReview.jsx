import React, { useEffect, useState } from 'react';
import { categories } from '../statements/categories.js';
import { reviewRows, reviewedResult } from '../statements/review.js';
import { parsePoundsToPence } from '../account.js';
import { formatMoney } from '../utils/format.js';

export default function StatementReview({ draft, onConfirm, onCancel }) {
  const [rows, setRows] = useState(() => reviewRows(draft.result));
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!draft.file || !/\.(png|jpe?g)$/i.test(draft.file.name)) return;
    const url = URL.createObjectURL(draft.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.file]);
  function edit(id, field, value) {
    setRows((previous) => previous.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setAcknowledged(false);
    setError('');
  }
  function addMissing() {
    setRows((previous) => [...previous, { id: `review-${crypto.randomUUID()}`, price: '', isoDate: '',
      description: '', category: 'Other / needs review', confidence: 0, included: true, page: null }]);
    setAcknowledged(false);
  }
  const selected = rows.filter((row) => row.included);
  const total = selected.reduce((sum, row) => sum + (parsePoundsToPence(row.price) ?? 0), 0);
  const extractedTotal = draft.result.transactions.reduce((sum, row) => sum + row.amount, 0);
  return (
    <form className="statement-review card" onSubmit={(event) => {
      event.preventDefault();
      try {
        if (!acknowledged) throw new Error('Confirm that you have checked the selected transactions.');
        onConfirm(reviewedResult(draft.result, rows));
      } catch (failure) { setError(failure.message); }
    }}>
      <h3>Review before importing</h3>
      <p className="file-name">{draft.fileName}</p>
      <p>Nothing from this upload has changed Home or your balance. Check the outgoing column, dates and amounts against the original. OCR can misread small or blurry text.</p>
      <p>Incoming payments and running balances should not be selected. Unclear or zero-value rows start unselected.</p>
      {draft.result.declaredTotal == null ? <p className="notice">No outgoing summary total was found. Check completeness against the original.</p>
        : extractedTotal !== draft.result.declaredTotal && <p className="notice">Extracted {formatMoney(extractedTotal)}; statement summary {formatMoney(draft.result.declaredTotal)}. This may be an incomplete or inconsistent example. Check missing pages and misread rows.</p>}
      {draft.result.unresolved > 0 && <p className="notice">{draft.result.unresolved} entries could not be read reliably. Check the original and add or correct missing rows below.</p>}
      {(draft.result.warnings ?? []).map((warning) => <p className="notice" key={warning}>{warning}</p>)}
      {preview && <details><summary>Show original image</summary><img className="statement-image" src={preview} alt="Original uploaded statement for comparison" /></details>}
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Review extracted transactions">
        <table><caption>Editable outgoing transactions</caption>
          <thead><tr><th scope="col">Include</th><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Amount (£)</th><th scope="col">Category</th><th scope="col">Check</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.id}>
            <td><input type="checkbox" aria-label={`Include row ${index + 1}`} checked={row.included} onChange={(event) => edit(row.id, 'included', event.target.checked)} /></td>
            <td><input type="date" aria-label={`Date for row ${index + 1}`} value={row.isoDate} onChange={(event) => edit(row.id, 'isoDate', event.target.value)} /></td>
            <td><input maxLength={200} aria-label={`Description for row ${index + 1}`} value={row.description} onChange={(event) => edit(row.id, 'description', event.target.value)} /></td>
            <td><input inputMode="decimal" aria-label={`Amount for row ${index + 1}`} value={row.price} onChange={(event) => edit(row.id, 'price', event.target.value)} /></td>
            <td><select aria-label={`Category for row ${index + 1}`} value={row.category} onChange={(event) => edit(row.id, 'category', event.target.value)}>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select></td>
            <td>{(row.confidence ?? 100) < 80 ? 'Check text carefully' : row.category === 'Other / needs review' ? 'Check category' : 'Suggested'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <button type="button" className="secondary" onClick={addMissing}>Add a missing row</button>
      <p><strong>{selected.length} selected · {formatMoney(total)} outgoing</strong></p>
      <label className="check"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
        I have checked the selected amounts, dates and outgoing rows against the original.
      </label>
      {error && <p className="notice" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={!acknowledged || !selected.length}>Confirm and import selected</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel import</button>
      </div>
    </form>
  );
}
