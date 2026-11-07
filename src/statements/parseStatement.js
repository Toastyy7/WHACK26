import { categorize } from './categories.js';
import { findStatementPeriod, normalizeTransactionDate } from './dates.js';

const compact = (text) => text.toLowerCase().replace(/[^a-z]/g, '');
const moneyPattern = /^£?\s*(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/;
const datePattern = /^(?:\d{1,2}\s+[A-Za-z]{3,9}(?:\s+\d{2,4})?|\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?)$/;
const typePattern = /^(?:VIS|TFR|BP|CR|DR|DD|SO|FPO|FPI|POS|DEB|ATM|CHQ|CPT|\)\)\))$/i;

function parseMoney(text) {
  const match = text.trim().match(moneyPattern);
  return match ? Number(match[1].replaceAll(',', '')) * 100 + Number(match[2]) : null;
}

// PDF text arrives as positioned fragments. Group fragments by baseline, then read left to right.
export function groupRows(items) {
  const rows = [];
  for (const item of [...items].filter((item) => item.text.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
    let row = rows.find((row) => Math.abs(row.y - item.y) < 2);
    if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  return rows.map((row) => ({ ...row, items: row.items.sort((a, b) => a.x - b.x) }));
}

function findColumns(rows) {
  for (const row of rows) {
    // Match headings independently of spacing, currency symbols and bank names.
    const out = row.items.find((item) => /^(paidout|moneyout|debit|debits|withdrawals)$/.test(compact(item.text)));
    const incoming = row.items.find((item) => /^(paidin|moneyin|credit|credits|deposits)$/.test(compact(item.text)));
    const balance = row.items.find((item) => /^(balance|runningbalance)$/.test(compact(item.text)));
    if (out && incoming) return { y: row.y, out, incoming, balance };
  }
  return null;
}

// Parse explicit outgoing/incoming columns only. Never guess from a running balance.
export function parseStatement(pages) {
  const transactions = [];
  const period = findStatementPeriod(pages);
  let currentDate = '';
  let declaredTotal = null;
  let supportedPages = 0;
  let unresolved = 0;

  for (const [pageIndex, items] of pages.entries()) {
    const rows = groupRows(items);
    for (const row of rows) {
      const label = row.items.find((item) => /^(paymentsout|totalpaidout|totalmoneyout|totaldebits)$/.test(compact(item.text)));
      if (label) {
        const value = row.items.find((item) => item.x > label.x && parseMoney(item.text) !== null);
        if (value) declaredTotal = parseMoney(value.text);
      }
    }
    const columns = findColumns(rows);
    if (!columns) continue; // Terms pages and unsupported layouts are not interpreted as transactions.
    supportedPages += 1;
    let pending = null;
    function finish() {
      if (pending?.amount !== null && pending?.amount !== undefined) {
        const description = pending.parts.join(' ').trim();
        if (!description) { unresolved += 1; }
        else transactions.push({ id: `${pageIndex}-${transactions.length}`, date: pending.date || 'Not shown',
          description, amount: pending.amount, category: categorize(description), page: pageIndex + 1 });
      }
      pending = null;
    }

    for (const row of rows.filter((row) => row.y < columns.y - 2)) {
      const text = row.items.map((item) => item.text).join(' ');
      if (/balance\s+(?:brought|carried)\s+forward/i.test(text)) { finish(); continue; }
      if (/customer service|interest rates|information about|deposit is eligible/i.test(text)) { finish(); break; }
      const left = row.items.filter((item) => item.x < Math.min(columns.out.x, columns.incoming.x) - 15);
      const date = left.find((item) => datePattern.test(item.text.trim()));
      const type = left.find((item) => typePattern.test(item.text.trim()));
      if (date || type) {
        finish();
        if (date) currentDate = date.text.trim();
        pending = { date: currentDate, parts: [], amount: null };
      }
      if (!pending) continue;
      pending.parts.push(...left.filter((item) => item !== date).map((item) => item.text.trim()));
      for (const item of row.items) {
        const amount = parseMoney(item.text);
        if (amount === null || item.x < Math.min(columns.out.x, columns.incoming.x) - 15) continue;
        // Numeric columns are right-aligned, so compare their right edges.
        const candidates = [columns.out, columns.incoming, columns.balance].filter(Boolean);
        const edge = item.x + item.width;
        const closest = [...candidates].sort((a, b) => Math.abs(edge - a.x - a.width) - Math.abs(edge - b.x - b.width))[0];
        if (closest === columns.out && Math.abs(edge - closest.x - closest.width) < 35) {
          if (pending.amount !== null) unresolved += 1;
          else pending.amount = amount;
        }
      }
    }
    finish();
  }
  return {
    transactions: transactions.map((transaction) => ({
      ...transaction,
      isoDate: normalizeTransactionDate(transaction.date, period),
    })),
    period, declaredTotal, supportedPages, pageCount: pages.length, unresolved,
  };
}
