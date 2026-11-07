# Adaptive Credit Guard

A React prototype for the Capital One Making Credit Accessible hackathon. The demo uses a simulated UK credit card account and runs entirely in the browser. Refreshing or resetting restores the fixture.

## Run the prebuilt demo offline

From this folder, run `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist` and open http://127.0.0.1:4173. Python 3 is the only requirement for the prebuilt demo.

## Work on the source

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

The first install needs network access. Copy the source files into your team repo and leave `node_modules` and `dist` out of Git.

## Where to find the code

- `src/main.jsx` — starts React and loads the stylesheet.
- `src/App.jsx` — page layout, shared account state and demo reset.
- `src/components/AccountOverview.jsx` — current balance and credit limit.
- `src/components/SafeZoneGauge.jsx` — balance gauge and purchase input.
- `src/components/PurchaseProjection.jsx` — what-if purchase results.
- `src/components/RequestGrace.jsx` — edit, review and submit a support request.
- `src/components/DemoControls.jsx` — balance, credit limit and target settings.
- `src/account.js` — initial demo data, money parsing and gauge calculations.
- `src/utils/format.js` — currency and percentage display helpers.
- `src/style.css` — page styling.

Start with `App.jsx` to see how the screen fits together, then open the component you want to change. Money is stored in integer pence, so `28000` represents £280. The purchase input stays in the gauge component; shared account data lives in `App` and components change it through `updateAccount`.

## Demo in 90 seconds

1. Start at Alex’s standard dashboard with £280 used out of £1,000.
2. Enter £50 in the purchase preview. Show the projected £330, 33% and £30 above Alex’s target. Clear the preview.
3. Ask for payment support. Review and confirm the editable message. Show reference AG-014 and pending review.

Demo controls can change the current balance, credit limit and credit limit target.

See `project-brief.md` for the pitch, six-slide outline and judge Q&A.

## Request Grace status demo

Edit and review the request, then read the disclaimer and acknowledge the simple terms before sending. Use “Update request status” to advance from received to reviewing, then to a random accepted or declined decision. The decision stays fixed until Reset demo. No real request is sent or payment arrangement created.

## Statement analysis

Open **Menu → Statement analysis**, choose a GBP bank statement PDF, then review the category summary and expandable transaction table. Change any suggested category using its dropdown; totals update immediately. Transfers and cash remain visible as a separate category within total outgoing payments.

Processing uses PDF.js locally in the browser, including its bundled worker. The PDF itself is read in memory and is not saved or sent to a server. Extracted transactions, the filename and category edits are saved in this browser’s local storage and appear on Home after refresh. **Clear statement**, **Remove saved statement**, or **Reset demo** deletes these saved results. Theme preference is stored separately and is preserved by Reset demo. If storage is blocked or full, the app shows a warning and keeps results for the current visit only.

The importer identifies separate outgoing/incoming column headings and uses the positions of amounts to exclude incoming payments and running balances. It supports text PDFs with Paid out/Paid in, Money out/Money in, Debit/Credit or Withdrawals/Deposits headings. It does not support every bank layout, scanned images, password-protected PDFs, or non-GBP statements. Limits: 20 MB and 100 pages. A detected summary total is compared with the extracted total; mismatches or a missing summary are displayed for review. A matching total is a useful check, not a guarantee that every row is correct.

Category suggestions use general merchant/description keyword rules. Unknown merchants stay under **Other / needs review**. No example statement, personal transactions, or fixed statement totals are bundled with the app.

- `src/components/StatementAnalysis.jsx` — upload, totals, category breakdown and review table.
- `src/statements/readPdf.js` — local PDF text extraction and file limits.
- `src/statements/parseStatement.js` — positioned transaction parsing and reconciliation data.
- `src/statements/categories.js` — category rules and grouping.
- `src/statements/parseStatement.test.js` — synthetic parser and categorisation checks.

### Saved Home summary and dates

After a successful upload, open Home (or select **View summary on Home**) to see saved spending. Home shows the total outgoing and a simple transaction list, newest first, with dates, descriptions and amounts. Detailed categories and editing remain in Statement analysis. Dates use the transaction’s printed year, or the statement date range when the bank omits years. They never silently use the current year. Transactions with unknown dates appear at the end of the Home list with their original date text.

- `src/components/HomeSpendingSummary.jsx` — simple Home total and dated transaction list.
- `src/hooks/useSavedStatement.js` — shared saved state and storage error handling.
- `src/statements/storage.js` — versioned browser storage, loading and removal.
- `src/statements/dates.js` — calendar dates, statement ranges and grouping.

### Choose which transactions to include

Use **Remove** beside a Home transaction to exclude it from the list and spending total. Expand **Add removed transactions** to restore it. You can also use the **Include** checkboxes in Statement analysis’s transaction table. Category totals follow the selection; the PDF reconciliation always uses all extracted transactions. Selections are saved after refresh and cleared by Reset demo.
