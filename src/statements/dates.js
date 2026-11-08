// Use calendar strings (YYYY-MM-DD), avoiding timezone shifts in bank transaction dates.
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function calendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function findStatementPeriod(pages) {
  // A date range supplies the year for banks that print only day and month per row.
  const pattern = /\b(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{4}))?\s+(?:to|[-–])\s+(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})\b/i;
  for (const items of pages) {
    const match = items.map((item) => item.text).join(' ').match(pattern);
    if (!match) continue;
    const startMonth = months.indexOf(match[2].slice(0, 3).toLowerCase()) + 1;
    const endMonth = months.indexOf(match[5].slice(0, 3).toLowerCase()) + 1;
    if (!startMonth || !endMonth) continue;
    const endYear = Number(match[6]);
    const startYear = match[3] ? Number(match[3]) : endYear - (startMonth > endMonth ? 1 : 0);
    const start = calendarDate(startYear, startMonth, Number(match[1]));
    const end = calendarDate(endYear, endMonth, Number(match[4]));
    if (start && end && start <= end) return { start, end };
  }
  // Some banks provide only a statement date. Make the inferred year explicit.
  const text = pages.flat().map((item) => item.text).join(' ');
  const statementDate = text.match(/statement\s+date\s+\d{1,2}\s+[a-z]{3,9}\s+(\d{4})/i);
  if (statementDate) return { start: `${statementDate[1]}-01-01`, end: `${statementDate[1]}-12-31`, inferred: true };
  return null;
}

export function normalizeTransactionDate(raw, period = null) {
  raw = raw.trim().replace(/(\d)-?([A-Za-z])/g, '$1 $2').replace(/([A-Za-z])(\d{2,4})\b/g, '$1 $2');
  let day, month, year;
  const named = raw.match(/^(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{2}|\d{4}))?$/i);
  const numeric = raw.match(/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2}|\d{4}))?$/);
  if (named) {
    day = Number(named[1]);
    month = months.indexOf(named[2].slice(0, 3).toLowerCase()) + 1;
    year = named[3];
  } else if (numeric) {
    [, day, month, year] = numeric;
    day = Number(day); month = Number(month);
  } else return null;
  if (!month) return null;
  if (year) return calendarDate(Number(year) + (year.length === 2 ? 2000 : 0), month, day);
  // Do not silently assign this year to an old statement with missing years.
  if (!period) return null;
  const candidates = [...new Set([Number(period.start.slice(0, 4)), Number(period.end.slice(0, 4))])]
    .map((candidate) => calendarDate(candidate, month, day))
    .filter((date) => date && date >= period.start && date <= period.end);
  return candidates.length === 1 ? candidates[0] : null;
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

export function filterByMonth(transactions, month) {
  if (month === 'all') return transactions;
  if (month === 'undated') return transactions.filter((transaction) => !transaction.isoDate);
  return transactions.filter((transaction) => transaction.isoDate?.slice(0, 7) === month);
}

export function groupByDate(transactions) {
  const groups = new Map();
  for (const transaction of transactions) {
    const date = transaction.isoDate || 'undated';
    const group = groups.get(date) ?? { date, amount: 0, count: 0 };
    group.amount += transaction.amount;
    group.count += 1;
    groups.set(date, group);
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
}
