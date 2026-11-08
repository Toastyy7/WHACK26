import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatement } from './parseStatement.js';
import { normalizeTransactionDate } from './dates.js';

const item = (text, x, y, width = text.length * 8) => ({ text, x, y, width, height: 20 });

test('reads OCR word fragments with In before Out, dates without spaces, and multiline descriptions', () => {
  const result = parseStatement([[
    item('01 September 2019 to 30 November 2019', 0, 900),
    item('Money', 0, 850), item('Out', 50, 850), item('£35.25', 200, 850),
    item('Date', 0, 800), item('Description', 150, 800), item('Type', 500, 800),
    item('In', 650, 800), item('(£)', 680, 800), item('Out', 800, 800), item('(£)', 840, 800), item('Balance', 950, 800),
    item('04', 0, 750), item('Sep19', 30, 753), item('COFFEE', 150, 750), item('SHOP', 215, 753), item('DEB', 500, 750),
    item('12.25', 802, 751), item('300.00', 957, 750),
    item('09', 0, 700), item('Sep19', 30, 700), item('TRANSFER', 150, 700), item('TFR', 500, 700), item('50.00', 650, 700), item('350.00', 950, 700),
    item('11', 0, 650), item('Sep19', 30, 650), item('UNKNOWN', 150, 650), item('DEB', 500, 650), item('20.00', 800, 650),
    item('STORE', 150, 627),
    item('15', 0, 600), item('Sep19', 30, 600), item('BUS', 150, 600), item('DEB', 500, 600), item('3.00', 810, 600),
  ]]);
  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions.reduce((sum, row) => sum + row.amount, 0), 3525);
  assert.equal(result.declaredTotal, 3525);
  assert.equal(result.transactions[0].isoDate, '2019-09-04');
  assert.match(result.transactions[1].description, /UNKNOWN STORE/);
  assert.ok(!result.transactions.some((row) => row.description.includes('TRANSFER')));
});

test('supports Out/In headings with currency before labels and yearless dashed dates', () => {
  assert.equal(normalizeTransactionDate('1-Apr', { start: '2020-04-01', end: '2020-05-15' }), '2020-04-01');
  assert.equal(normalizeTransactionDate('04 Sep19'), '2019-09-04');
  const result = parseStatement([[
    item('1 April to 15 May 2020', 0, 900),
    item('Date', 0, 800), item('Description', 150, 800), item('£', 600, 800), item('Out', 620, 800), item('£', 730, 800), item('In', 750, 800), item('£ Balance', 880, 800),
    item('1-Apr', 0, 750), item('TESCO STORE', 150, 750), item('5.00', 610, 750),
    item('2-Apr', 0, 700), item('REFUND', 150, 700), item('2.00', 745, 700),
  ]]);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].isoDate, '2020-04-01');
});

test('cash transaction types are categorised as cash and supermarket fuel as travel', () => {
  const rows = [[
    item('Date', 0, 800), item('Description', 150, 800), item('Type', 500, 800), item('Out', 650, 800), item('In', 800, 800), item('Balance', 950, 800),
    item('04 Sep 2019', 0, 750), item('CARD WITHDRAWAL', 150, 750), item('CPT', 500, 750), item('20.00', 650, 750),
    item('05 Sep 2019', 0, 700), item('MORRISONS PETROL', 150, 700), item('DEB', 500, 700), item('15.00', 650, 700),
  ]];
  const result = parseStatement(rows);
  assert.equal(result.transactions[0].category, 'Transfers & cash');
  assert.equal(result.transactions[1].category, 'Transport & travel');
});

test('unreadable outgoing digits are flagged rather than silently guessed', () => {
  const result = parseStatement([[
    item('Date', 0, 800), item('Description', 150, 800), item('Out', 650, 800), item('In', 800, 800), item('Balance', 950, 800),
    item('04 Sep 2019', 0, 750), item('UNKNOWN SHOP', 150, 750), item('£1O.00', 650, 750),
    item('05 Sep 2019', 0, 700), item('BUS', 150, 700), item('3.00', 650, 700),
  ]]);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.unresolved, 1);
  assert.equal(result.transactions[0].amount, 300);
});
