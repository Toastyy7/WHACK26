import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatement, groupRows } from './parseStatement.js';
import { categorize, summarize } from './categories.js';

// Synthetic, positioned PDF fragments: no personal statement data is stored in tests.
const text = (value, x, y, width = 60) => ({ text: value, x, y, width });
const outgoing = (value, y) => text(value, 340, y, 40);
const incoming = (value, y) => text(value, 440, y, 40);
const balance = (value, y) => text(value, 540, y, 40);
function header(y = 700) {
  return [text('Date', 20, y), text('Details', 140, y),
    text('£ Paid out', 320, y), text('£ Paid in', 420, y), text('£ Balance', 520, y)];
}

test('extracts multiline outgoings, excludes income and balances, and reconciles summary', () => {
  const result = parseStatement([[
    text('Paym e nts Out', 320, 800), outgoing('1,013.25', 800), ...header(),
    text('01 Jan 26', 20, 670), text('VIS', 100, 670), text('PIZZA RESTAURANT', 140, 670),
    text('LONDON', 140, 658), outgoing('13.25', 658), balance('100.00', 658),
    text('02 Jan 26', 20, 640), text('CR', 100, 640), text('SALARY', 140, 640),
    incoming('2,000.00', 640), balance('2,100.00', 640),
    text('TFR', 100, 620), text('INTERNET TRANSFER', 140, 620), outgoing('1,000.00', 620),
    text('BALANCE CARRIED FORWARD', 140, 600), balance('1,100.00', 600),
  ]]);
  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[0].amount, 1325);
  assert.equal(result.transactions[0].category, 'Takeaways & dining');
  assert.match(result.transactions[0].description, /LONDON/);
  assert.equal(result.transactions[1].category, 'Transfers & cash');
  assert.equal(result.transactions.reduce((sum, row) => sum + row.amount, 0), result.declaredTotal);
});

test('continues dates across pages and preserves repeated purchases', () => {
  const purchase = (y) => [text(')))', 100, y), text('TESCO', 140, y), outgoing('5.00', y)];
  const result = parseStatement([
    [...header(), text('03 Feb 26', 20, 670), ...purchase(670), ...purchase(650)],
    [...header(), text('BALANCE BROUGHT FORWARD', 140, 680), balance('50.00', 680), ...purchase(660)],
    [text('Terms and conditions', 20, 700)],
  ]);
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions[2].date, '03 Feb 26');
  assert.equal(result.transactions[2].page, 2);
  assert.equal(result.supportedPages, 2);
  assert.equal(result.pageCount, 3);
});

test('accepts debit/credit headings and does not treat incoming refunds as spending', () => {
  const columns = header().map((item) => ({ ...item, text: item.text.replace('£ Paid out', 'Debit').replace('£ Paid in', 'Credit') }));
  const result = parseStatement([[...columns,
    text('03/02/2026', 20, 670), text('UNFAMILIAR MERCHANT', 140, 670), outgoing('10.00', 670),
    text('04/02/2026', 20, 650), text('REFUND', 140, 650), incoming('5.00', 650),
  ]]);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].category, 'Other / needs review');
  assert.equal(result.declaredTotal, null);
});

test('rejects unsupported layouts instead of guessing from amounts', () => {
  const result = parseStatement([[text('Balance 100.00', 20, 700), text('Some merchant 10.00', 20, 680)]]);
  assert.deepEqual(result.transactions, []);
  assert.equal(result.supportedPages, 0);
});

test('groups fragments by baseline even when PDF items are unordered', () => {
  const rows = groupRows([text('Second', 20, 650), text('Right', 100, 700), text('Left', 20, 700.5)]);
  assert.deepEqual(rows[0].items.map((item) => item.text), ['Left', 'Right']);
});

test('categories are general suggestions and edited categories change totals', () => {
  assert.equal(categorize('JUST EAT'), 'Takeaways & dining');
  assert.equal(categorize('TFL TRAVEL'), 'Transport & travel');
  assert.equal(categorize('Unknown business'), 'Other / needs review');
  assert.equal(categorize('Amazon Prime'), 'Entertainment & subscriptions');
  const transactions = [{ amount: 250, category: 'Shopping' }, { amount: 350, category: 'Groceries' }];
  assert.equal(summarize(transactions)[0].category, 'Groceries');
  transactions[0].category = 'Groceries';
  assert.deepEqual(summarize(transactions), [{ category: 'Groceries', amount: 600, count: 2 }]);
});

test('accepts Nationwide-style £Out/£In and Payments out/in headings', () => {
  for (const [out, inn] of [['£Out', '£In'], ['£ Out', '£ In'], ['Payments out', 'Payments in']]) {
    const columns = header().map((item) => ({ ...item, text: item.text.replace('£ Paid out', out).replace('£ Paid in', inn) }));
    const result = parseStatement([[...columns,
      text('03 Feb 2026', 20, 670), text('TESCO STORES', 140, 670), outgoing('12.50', 670), balance('100.00', 670),
      text('04 Feb 2026', 20, 650), text('SALARY', 140, 650), incoming('900.00', 650), balance('1000.00', 650),
    ]]);
    assert.equal(result.transactions.length, 1, out);
    assert.equal(result.transactions[0].amount, 1250, out);
  }
});
