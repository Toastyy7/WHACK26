import React, { useEffect, useRef, useState } from 'react';
import { categories, summarize } from '../statements/categories.js';
import { formatMoney, formatPercent } from '../utils/format.js';

export default function StatementAnalysis({ savedStatement, onSave, onClear, onViewHome }) {
  // App owns saved results so Home and this screen always use the same transactions.
  const result = savedStatement?.result ?? null;
  const [pendingFileName, setPendingFileName] = useState('');
  const fileName = pendingFileName || savedStatement?.fileName || '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  // Ignore a late result if the user clears the upload or resets the demo.
  const uploadId = useRef(0);
  useEffect(() => () => { uploadId.current += 1; }, []);

  function clear() {
    uploadId.current += 1;
    onClear();
    setPendingFileName('');
    setBusy(false);
    setError('');
    if (input.current) input.current.value = '';
  }

  async function upload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const id = ++uploadId.current;
    setPendingFileName(file.name);
    setError('');
    setBusy(true);
    try {
      if (!/\.pdf$/i.test(file.name)) throw new Error('Please choose a PDF statement.');
      // Load the PDF reader only when needed, keeping the home screen lightweight.
      const { readStatement } = await import('../statements/readPdf.js');
      const extracted = await readStatement(file);
      if (id === uploadId.current) {
        onSave({ fileName: file.name, result: extracted, savedAt: Date.now() });
        setPendingFileName('');
      }
    } catch (failure) {
      if (id === uploadId.current) {
        setPendingFileName('');
        const message = failure.message || 'The statement could not be read. Please try another PDF.';
        setError(savedStatement ? `${message} Your previous saved statement has been kept.` : message);
      }
    } finally {
      if (id === uploadId.current) setBusy(false);
    }
  }

  function changeCategory(id, category) {
    onSave({
      ...savedStatement,
      result: {
        ...result,
        transactions: result.transactions.map((transaction) =>
          transaction.id === id ? { ...transaction, category } : transaction),
      },
    });
  }

  const transactions = result?.transactions ?? [];
  const groups = summarize(transactions);
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const needsReview = transactions.filter((transaction) => transaction.category === 'Other / needs review').length;

  return (
    <section className="card statement-analysis" aria-busy={busy}>
      <h2>Understand your outgoing spending</h2>
      <p>Upload a bank statement to group outgoing payments into general spending categories.</p>
      <p className="muted">Your PDF is processed on this device. It is not uploaded to a server. Extracted transactions and category edits are saved in this browser and shown on Home. The PDF itself is not saved. Clear the statement or reset the demo to delete saved results.</p>
      <label>
        GBP bank statement (PDF, up to 20 MB)
        <input ref={input} type="file" accept="application/pdf,.pdf" onChange={upload} disabled={busy} />
      </label>
      <p className="muted">Supports GBP text-based statements with separate outgoing and incoming columns. Scanned image PDFs need OCR and cannot be read yet.</p>
      {fileName && (
        <div className="actions">
          <p className="file-name">{fileName}</p>
          <button className="secondary" onClick={clear}>Clear statement</button>
        </div>
      )}
      <div role="status">{busy && <p>Reading the statement and categorising outgoing payments…</p>}</div>
      {error && <p role="alert" className="notice">{error}</p>}
      {result && !busy && (
        <>
          <p role="status">Results are available on Home. If browser storage is available, they will also remain after refresh.</p>
          <button className="secondary" onClick={onViewHome}>View summary on Home</button>
          <div className="notice" role="status">
            {result.declaredTotal === null ? (
              <p>No outgoing summary total was detected. Completeness is unverified; compare the transactions below with your statement.</p>
            ) : total === result.declaredTotal ? (
              <p>Extracted outgoing total matches the statement’s summary: <strong>{formatMoney(total)}</strong>.</p>
            ) : (
              <p><strong>Some transactions may be missing or misread.</strong> Extracted {formatMoney(total)}; statement summary {formatMoney(result.declaredTotal)}. Difference: {formatMoney(Math.abs(total - result.declaredTotal))}. Review against the original PDF.</p>
            )}
            <p>Recognised transaction tables on {result.supportedPages} of {result.pageCount} pages. Other pages may contain notes or unsupported layouts.</p>
            {result.unresolved > 0 && <p>{result.unresolved} ambiguous entries need checking against the original PDF.</p>}
          </div>
          <div className="statement-stats">
            <div><span>Total outgoing</span><strong>{formatMoney(total)}</strong></div>
            <div><span>Outgoing transactions</span><strong>{transactions.length}</strong></div>
            <div><span>Uncategorised</span><strong>{needsReview}</strong></div>
          </div>
          <h3>Spending by category</h3>
          <p className="muted">Suggested from merchant names and descriptions. Transfers and cash are included in outgoing totals; they may not represent purchases. Income and refunds in the incoming column are excluded.</p>
          <ul className="category-summary">
            {groups.map((group) => (
              <li key={group.category}>
                <div className="category-heading">
                  <span>{group.category} · {group.count} payment{group.count === 1 ? '' : 's'}</span>
                  <strong>{formatMoney(group.amount)} ({formatPercent(total ? group.amount / total * 100 : 0)})</strong>
                </div>
                <div className="category-track" aria-hidden="true">
                  <div style={{ width: `${total ? group.amount / total * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <details className="transaction-review">
            <summary>Review all {transactions.length} outgoing transactions and edit categories</summary>
            <p>Category edits update the summary immediately. The page number helps you check the original statement.</p>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Outgoing transaction table">
              <table>
                <caption>Extracted outgoing transactions</caption>
                <thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Page</th><th scope="col">Outgoing</th><th scope="col">Category</th></tr></thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.date}</td><td>{transaction.description}</td><td>{transaction.page}</td>
                      <td className="amount-cell">{formatMoney(transaction.amount)}</td>
                      <td><select aria-label={`Category for ${transaction.description} on ${transaction.date}`}
                        value={transaction.category} onChange={(event) => changeCategory(transaction.id, event.target.value)}>
                        {categories.map((category) => <option key={category}>{category}</option>)}
                      </select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
