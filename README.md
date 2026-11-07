# Adaptive Credit Guard

A browser-only hackathon prototype: a simulated credit-card dashboard and a CheckoutGuard extension for Chrome and Firefox. No live banking, payment or support service is connected. The dashboard and extension use separate demo budgets; they do not sync.

## Get started

Use Node **20.19+ or 22.12+** (`nvm use` selects Node 22).

```sh
git switch jamieBranch
git pull --ff-only
npm ci
npm start
```

Open the URL printed by Vite, usually `http://127.0.0.1:5173`. Adaptive Mode starts on so the gauge, payments and support tools are visible. Turn it off to compare the standard view. Source HTML needs the dev server; do not open the root `index.html` directly.

`node_modules` and the obsolete `.next` cache are no longer tracked on this branch. Install dependencies with `npm ci` after pulling. The lockfile is committed. The prebuilt `dist/` demo is deliberately kept in Git for offline use.

### Offline demo without Node

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:4173`. Rebuild with `npm run build` after changing dashboard source. The bundle also works when hosted under a subdirectory.

## Load CheckoutGuard

The extension is plain HTML, CSS and JavaScript in `checkout-guard/`; it has no build step. Chrome and Firefox use the same folder.

**Chrome / Edge / Brave:** open `chrome://extensions` (or the browser's extensions page), enable Developer mode, choose **Load unpacked** and select `checkout-guard`.

**Desktop Firefox 142+:** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and select `checkout-guard/manifest.json`. A temporary add-on is removed when Firefox restarts. Permanent installation requires Mozilla signing; this project has not been submitted or published. [Mozilla loading instructions](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

After an update, reload the extension from its extensions/debugging page and refresh any existing checkout tabs.

### Try a checkout locally

With `npm start` running, open `http://127.0.0.1:5173/checkout-guard/test-checkout.html` (use the port Vite printed). Alternatively, serve the repository root with `python3 -m http.server 4180 --bind 127.0.0.1` and use port 4180. The fixture needs no real card details and cannot place an order.

Open the extension's toolbar popup and set a £300 monthly budget:

| Current spend | Popup | After the £69.99 test order |
| --- | --- | --- |
| £120 | £180 remaining · green | £110.01 remaining · green |
| £240 | £60 remaining · amber | £9.99 over budget · red |
| £360 | £60 over budget · red | £129.99 over budget · red |

Settings changes preview immediately in the popup. **Save Changes** applies them to open checkout dialogs. The on/off switch works immediately, even while a budget field contains invalid input. Reset Demo restores £300 budget, £120 spent and a 15-second pause.

### Checkout behaviour

- Detection combines visible payment fields, checkout containers, final-order buttons, route and total signals. Ordinary product/search pages should stay quiet. It does not read card numbers or security codes.
- The gauge measures the monthly budget: green below 80%, amber from 80% through 100%, and red above 100%. Text shows the real percentage even above 100%; only the bar width is capped.
- Order totals are **GBP only**. Missing or foreign-currency totals show no calculation until you enter a GBP amount. The extension never assumes a £35 purchase or silently converts dollars/euros.
- Changing an order total recalculates its impact and starts a fresh pause. Saving a new budget updates the existing preview without restarting the pause. Disabling the guard closes it immediately.
- Continue unlocks after the reflection pause. Close or Escape dismisses a preview immediately. Tab stays inside the dialog and focus returns when it closes. A dismissed order stays dismissed until its URL or detected total changes, or the page reloads.
- A preview does **not** record a purchase. Update Current month spend yourself. Leaving checkout does not cancel an order already placed.

Site layouts vary, and some totals inside cross-origin frames cannot be read. The manual amount field is the fallback. Browser-internal pages and protected extension-store pages do not permit this content script.

## Dashboard demo

The simulated account starts at £280 of £1,000 used, £25 due on 14 November and £75 available in the bank.

1. Enter £50 in the purchase preview: £330 / 33% and an amber gauge. £220 reaches 50% / red; £800 exceeds the limit. Clear preview restores the current gauge without changing the balance.
2. Adjust the target with the slider next to the gauge. These are planning bands, not credit-score predictions. The dashboard's credit-limit target differs from the extension's monthly spending budget.
3. Start the £10 weekly plan with a £50 cash buffer. Run the scheduled check: £270 card balance, £65 bank balance and £15 minimum still due. A week can be checked only once.
4. In Demo controls, advance a week and set the available bank balance to £55. The next £10 check skips because it would leave less than the buffer. Missing/stale balance data or a failed payment cannot deduct money.
5. Ask for payment support, edit the message, review and confirm. The simulated request shows reference AG-014 and awaits review; the remaining payment stays due. Cancel preserves the draft for later.

Demo controls also simulate support submission failure. A failed send preserves the draft for retry. Refresh or Reset demo restores the fixture, and reset cancels a pending simulated submission. No actual money is moved or message sent.

## Development and checks

| Command | Purpose |
| --- | --- |
| `npm start` / `npm run dev` | Start the dashboard and serve the checkout fixture |
| `npm test` | Account rules, GBP parsing, budget boundaries, storage failures and both extension APIs |
| `npm run build` | Rebuild the tracked offline dashboard |
| `npm run preview` | Serve the built dashboard |
| `npm run lint:extension` | Mozilla's extension validator |
| `npm run pack:extension` | Build an unsigned ZIP in ignored `web-ext-artifacts/` |
| `npm run test:browser` | Dashboard and extension browser regression checks |

Install the optional browser-test tools in a virtual environment:

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements-browser.txt
python -m playwright install chromium
npm run build
npm run test:browser
```

Set `CHROMIUM_PATH` to use an existing Chromium executable. Tests launch their own local server on a free port. They exercise real DOM/events with simulated Chrome storage, including save/read failures, live totals, manual GBP entry, focus, Escape, settings changes, support and payment flows. `python scripts/check-extension.py` remains an alias for these expanded checks. Firefox was also checked as an installed temporary add-on with real extension storage.

The production dependency audit is clean. Mozilla's current development-only validator depends on `deepmerge` with a low-severity advisory; that tooling is not included in the dashboard bundle or extension ZIP.

The GitHub Actions workflow runs on pushes to, or PRs targeting, **jamieBranch**. It checks tests, browser flows, validation and packaging, and produces demo/extension build artifacts. It has read-only repository permissions and does not deploy anything.

## Local data

Extension preferences stay in that browser's local extension storage. No analytics, external API or remote service receives checkout details. The extension requests storage permission and runs on allowed website pages to detect checkouts; the unused `activeTab` permission has been removed. Preferences do not sync between browsers or with the simulated dashboard.

See [project-brief.md](project-brief.md) for the pitch and [checkout-guard/ARCHITECTURE.md](checkout-guard/ARCHITECTURE.md) for the implementation.
