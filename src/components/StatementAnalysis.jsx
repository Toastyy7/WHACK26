import React, { useEffect, useRef, useState } from 'react';
import { categories, summarize } from '../statements/categories.js';
import { formatMoney, formatPercent } from '../utils/format.js';
import { includedTransactions } from '../statements/selection.js';
import AddTransactionForm from './AddTransactionForm.jsx';
import { appendManualTransaction, importedTransactions } from '../statements/manualTransactions.js';
import { getDemoStatement } from '../statements/demoStatement.js';

export default function StatementAnalysis({ savedStatement, onSave, onClear, onViewHome, onSelect }) {
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

  function loadDemo() {
    uploadId.current += 1;
    setError('');
    setBusy(false);
    setPendingFileName('');
    const manual = savedStatement?.result.transactions.filter((row) => row.source === 'manual' || row.source === 'checkout') ?? [];
    const demo = getDemoStatement();
    onSave({
      fileName: 'Capital-One-Statement-Oct2026.pdf',
      result: { ...demo, transactions: [...demo.transactions, ...manual] },
      savedAt: Date.now(),
    });
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
        // Replacing a PDF keeps manually entered payments.
        const manual = savedStatement?.result.transactions.filter((row) => row.source === 'manual' || row.source === 'checkout') ?? [];
        onSave({ fileName: file.name, result: { ...extracted, transactions: [...extracted.transactions, ...manual] }, savedAt: Date.now() });
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
  const selected = includedTransactions(transactions);
  const groups = summarize(selected);
  const selectedTotal = selected.reduce((sum, transaction) => sum + transaction.amount, 0);
  const imported = importedTransactions(transactions);
  const total = imported.reduce((sum, transaction) => sum + transaction.amount, 0);
  const needsReview = selected.filter((transaction) => transaction.category === 'Other / needs review').length;

  return (
    <section className="card statement-analysis" aria-busy={busy}>
      <h2>Understand your outgoing spending</h2>
      <p>Upload a bank statement to group outgoing payments into general spending categories.</p>
      <p className="muted">Your PDF is processed on this device. It is not uploaded to a server. Extracted transactions and category edits are saved in this browser and shown on Home. The PDF itself is not saved. Clear the statement or reset the demo to delete saved results.</p>
      <div className="demo-statement-box">
        <strong>Stage presentation demo</strong>
        <p className="muted">Test instant categorisation with a pre-configured Capital One statement without uploading a file.</p>
        <button type="button" className="secondary" onClick={loadDemo} disabled={busy}>
          ⚡ Load sample statement (October 2026)
        </button>
      </div>
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
      <AddTransactionForm disabled={busy}
        onAdd={(transaction) => onSave(appendManualTransaction(savedStatement, transaction))} />
      {result && !busy && (
        <>
          <p role="status">Results are available on Home. If browser storage is available, they will also remain after refresh.</p>
          <button className="secondary" onClick={onViewHome}>View summary on Home</button>
          {result.pageCount > 0 && <div className="notice" role="status">
            {result.declaredTotal === null ? (
              <p>No outgoing summary total was detected. Completeness is unverified; compare the transactions below with your statement.</p>
            ) : total === result.declaredTotal ? (
              <p>Extracted outgoing total matches the statement’s summary: <strong>{formatMoney(total)}</strong>.</p>
            ) : (
              <p><strong>Some transactions may be missing or misread.</strong> Extracted {formatMoney(total)}; statement summary {formatMoney(result.declaredTotal)}. Difference: {formatMoney(Math.abs(total - result.declaredTotal))}. Review against the original PDF.</p>
            )}
            <p>Recognised transaction tables on {result.supportedPages} of {result.pageCount} pages. Other pages may contain notes or unsupported layouts.</p>
            {result.unresolved > 0 && <p>{result.unresolved} ambiguous entries need checking against the original PDF.</p>}
          </div>}
          <div className="statement-stats">
            <div><span>Selected outgoing</span><strong>{formatMoney(selectedTotal)}</strong></div>
            <div><span>Selected transactions</span><strong>{selected.length} of {transactions.length}</strong></div>
            <div><span>Uncategorised</span><strong>{needsReview}</strong></div>
          </div>
          <h3>Selected spending by category</h3>
          <p className="muted">Suggested from merchant names and descriptions. Transfers and cash are included in outgoing totals; they may not represent purchases. Income and refunds in the incoming column are excluded.</p>
          <ul className="category-summary">
            {groups.map((group) => (
              <li key={group.category}>
                <div className="category-heading">
                  <span>{group.category} · {group.count} payment{group.count === 1 ? '' : 's'}</span>
                  <strong>{formatMoney(group.amount)} ({formatPercent(selectedTotal ? group.amount / selectedTotal * 100 : 0)})</strong>
                </div>
                <div className="category-track" aria-hidden="true">
                  <div style={{ width: `${selectedTotal ? group.amount / selectedTotal * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <details className="transaction-review">
            <summary>Review all {transactions.length} outgoing transactions and edit categories</summary>
            <p>Tick transactions to include them on Home and in category totals. Untick to remove them; you can add them back at any time. Manual entries are marked below and included in spending totals. Only imported entries are used to check the PDF total.</p>
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Outgoing transaction table">
              <table>
                <caption>Outgoing transactions</caption>
                <thead><tr><th scope="col">Include</th><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Source / page</th><th scope="col">Outgoing</th><th scope="col">Category</th></tr></thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td><input type="checkbox" checked={transaction.included !== false}
                        aria-label={`Include ${transaction.description}, ${transaction.date}, ${formatMoney(transaction.amount)}`}
                        onChange={(event) => onSelect(transaction.id, event.target.checked)} /></td>
                      <td>{transaction.date}</td><td>{transaction.description}</td><td>{transaction.source === 'checkout' ? 'Checkout (planned)' : transaction.source === 'manual' ? 'Manual' : transaction.page}</td>
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
