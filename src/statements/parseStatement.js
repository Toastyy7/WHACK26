import { categorize } from './categories.js';
import { findStatementPeriod, normalizeTransactionDate } from './dates.js';

const compact = (text) => text.toLowerCase().replace(/[^a-z]/g, '');
// OCR occasionally reads the pound sign as E, or a table border as I.
// These aliases apply only to headings, never to transaction amounts.
const headerText = (text) => compact(text).replace(/^e(?=in$|out$|balance$)/, '')
  .replace(/^en$/, 'in').replace(/^(?:equl|eoul|equt)$/, 'out').replace(/^(?:ipescription|pescription)$/, 'description');
const moneyPattern = /^£?\s*(\d{1,3}(?:,\d{3})*|\d+)\.(\d{1,2})$/;
const typePattern = /^(?:VIS|TFR|BP|CR|DR|DD|SO|FPO|FPI|POS|DEB|ATM|CHQ|CPT|CSH|BACS|\)\)\))$/i;

function parseMoney(text) {
  const match = text.trim().match(moneyPattern);
  return match ? Number(match[1].replaceAll(',', '')) * 100 + Number(match[2].padEnd(2, '0')) : null;
}

// OCR words have slightly different vertical centres even on the same printed line.
// Use text height to group them, while retaining the PDF reader's original precision.
export function groupRows(items) {
  const rows = [];
  for (const item of [...items].filter((item) => item.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
    const tolerance = Math.max(2, Math.min(26, (item.height || 0) * 0.65));
    let row = rows.find((row) => Math.abs(row.y - item.y) < tolerance);
    if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
    row.items.push(item);
    row.y = row.items.reduce((sum, part) => sum + part.y, 0) / row.items.length;
  }
  return rows.map((row) => ({ ...row, items: row.items.sort((a, b) => a.x - b.x) }));
}

// Join heading fragments such as "Paid" + "Out" or "Out" + "(£)".
function findLabel(row, pattern) {
  for (let start = 0; start < row.items.length; start += 1) {
    if (!compact(row.items[start].text)) continue;
    for (let length = 1; length <= 3 && start + length <= row.items.length; length += 1) {
      const parts = row.items.slice(start, start + length);
      if (!pattern.test(headerText(parts.map((item) => item.text).join(' ')))) continue;
      const first = parts[0];
      const last = parts.at(-1);
      return { x: first.x, width: last.x + last.width - first.x, parts };
    }
  }
  return null;
}

function findColumns(rows) {
  for (const row of rows) {
    if (!findLabel(row, /^date$/) && !findLabel(row, /^description$/)) continue; // A summary's Money In/Out is not a transaction header.
    const out = findLabel(row, /^(paidout|moneyout|paymentsout|out|debit|debits|withdrawals)$/);
    const incoming = findLabel(row, /^(paidin|moneyin|paymentsin|in|credit|credits|deposits)$/);
    const balance = findLabel(row, /^(balance|runningbalance)$/);
    if (out && incoming) return { y: row.y, out, incoming, balance };
  }
  return null;
}

function rowDate(items) {
  // Dates can be a single PDF fragment or several OCR words. They belong at the left edge.
  for (let length = Math.min(3, items.length); length >= 1; length -= 1) {
    const parts = items.slice(0, length);
    const raw = parts.map((item) => item.text).join(' ');
    if (/^\d{1,2}(?:\s*|-)[A-Za-z]{3,9}\s?\d{0,4}$/.test(raw) || /^\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?$/.test(raw)) {
      return { raw, parts };
    }
  }
  return null;
}

// Only explicit outgoing columns count. Running balances never become purchases.
export function parseStatement(pages) {
  const transactions = [];
  const period = findStatementPeriod(pages);
  let currentDate = '';
  let declaredTotal = null;
  let supportedPages = 0;
  let unresolved = 0;
  const warnings = [];

  for (const [pageIndex, items] of pages.entries()) {
    const rows = groupRows(items);
    const columns = findColumns(rows);
    for (const row of rows.filter((row) => !columns || row.y > columns.y + 2)) {
      const label = findLabel(row, /^(moneyout|paidout|paymentsout|totalpaidout|totalmoneyout|totaldebits)$/);
      if (label) {
        const value = row.items.find((item) => !label.parts.includes(item) && item.x > label.x && parseMoney(item.text) !== null);
        if (value) declaredTotal = parseMoney(value.text);
      }
    }
    if (!columns) continue;
    supportedPages += 1;
    const numericStart = Math.min(columns.out.x, columns.incoming.x, columns.balance?.x ?? Infinity);
    let pending = null;
    function finish() {
      if (pending?.unreadableOutgoing && pending.amount === null) unresolved += 1;
      if (pending?.amount != null) {
        const description = pending.parts.join(' ').trim();
        if (!description) unresolved += 1;
        else transactions.push({ id: `${pageIndex}-${transactions.length}`, date: pending.date || 'Not shown',
          description, amount: pending.amount, category: /^(CPT|ATM|CSH)$/i.test(pending.paymentType) ? 'Transfers & cash'
            : pending.paymentType === 'TFR' && categorize(description) === 'Other / needs review' ? 'Transfers & cash' : categorize(description),
          paymentType: pending.paymentType, page: pageIndex + 1,
          confidence: pending.confidence, source: 'statement' });
      }
      pending = null;
    }
    const lastColumn = Math.max(...[columns.out, columns.incoming, columns.balance].filter(Boolean).map((column) => column.x + column.width));
    // Remove sidebar text before grouping table lines, so unrelated text cannot
    // pull an amount into the wrong row on side-by-side statement layouts.
    const tableRows = groupRows(items.filter((item) => item.y < columns.y - 2 && item.x < lastColumn + 25));
    for (const row of tableRows) {
      const text = row.items.map((item) => item.text).join(' ');
      if (/balance\s+(?:brought|carried|received)\s+forward|^brought?\s+forward|^bright\s+forward/i.test(text)) { finish(); continue; }
      if (/customer service|interest rates|information about|deposit is eligible|authorised by|^royal bank|^https?:/i.test(text)) { finish(); break; }
      const left = row.items.filter((item) => item.x < numericStart - 20 &&
        !(parseMoney(item.text) !== null && item.x + item.width >= numericStart - 20));
      const date = rowDate(left);
      const type = left.find((item) => typePattern.test(item.text.trim()));
      if (date || type) {
        finish();
        if (date) currentDate = date.raw;
        pending = { date: currentDate, parts: [], amount: null, confidence: 100, paymentType: type?.text.trim().toUpperCase() || '' };
      }
      if (!pending) continue;
      pending.parts.push(...left.filter((item) => !date?.parts.includes(item) && item !== type).map((item) => item.text.trim()));
      const candidates = [columns.out, columns.incoming, columns.balance].filter(Boolean);
      for (const item of row.items) {
        const amount = parseMoney(item.text);
        if (item.x + item.width < numericStart - 20) continue;
        if (amount === null && !/[£]|\d[.,]\d/.test(item.text)) continue;
        const edge = item.x + item.width;
        const closest = [...candidates].sort((a, b) => Math.abs(edge - a.x - a.width) - Math.abs(edge - b.x - b.width))[0];
        // Scale the permitted alignment error to column spacing (OCR coordinates are pixels).
        const spacing = Math.min(...candidates.filter((candidate) => candidate !== closest).map((candidate) => Math.abs(candidate.x - closest.x)));
        if (closest === columns.out && Math.abs(edge - closest.x - closest.width) < spacing * 0.48) {
          if (amount === null) { pending.unreadableOutgoing = true; continue; }
          if (pending.amount !== null) unresolved += 1;
          else pending.amount = amount;
          pending.confidence = Math.min(pending.confidence, item.confidence ?? 100);
        }
      }
      if (pending) pending.confidence = Math.min(pending.confidence, ...left.map((item) => item.confidence ?? 100));
    }
    finish();
  }
  const text = pages.flat().map((item) => item.text).join(' ');
  const pageMarker = text.match(/\b(?:page\s*)?(\d+)\s*of\s*(\d+)\b/i);
  if (pageMarker && Number(pageMarker[2]) > pages.length) warnings.push('This upload appears to contain only part of a statement. Upload all pages before relying on the total.');
  if (period?.inferred) warnings.push('The transaction year was inferred from the statement date. Check dates, especially around New Year.');
  if (transactions.length && transactions.every((row) => row.amount === 0)) warnings.push('All extracted amounts are zero. This may be a blank template; check the original.');
  return { transactions: transactions.map((transaction) => ({ ...transaction, isoDate: normalizeTransactionDate(transaction.date, period) })),
    period, declaredTotal, supportedPages, pageCount: pages.length, unresolved, warnings };
}
