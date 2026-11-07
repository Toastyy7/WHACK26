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
