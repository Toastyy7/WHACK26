# Adaptive Credit Guard

A React prototype for the Capital One Making Credit Accessible hackathon, with a CheckoutGuard extension for Chrome and Firefox. The demo uses a simulated UK credit card account and runs entirely in the browser. Refreshing or resetting restores the fixture.

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

To get the fixes on your local checkout, switch to `jamieBranch`, run `git pull --ff-only`, then `npm ci` and `npm run dev`. Open the localhost URL printed by Vite. The React source needs the dev server; opening the root HTML file directly will not run it. For the Chrome extension, reload the unpacked extension in `chrome://extensions` and refresh the checkout tab after pulling changes.

Optional extension browser regression checks: install Python's `playwright` package in a virtual environment and run `python scripts/check-extension.py` with Chromium installed. Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`. These checks simulate Chrome storage and verify grouped prices, dismissal after Continue and a new warning when the total changes.

The first install needs network access. Copy the source files into your team repo and leave `node_modules` and `dist` out of Git.

## Demo in 90 seconds

1. Start at Alex’s standard dashboard with £280 used out of £1,000 and £25 due on 14 November.
2. Turn on Adaptive Mode. Enter £50 in the purchase preview. Show the projected £330, 33%, amber gauge and £30 above Alex’s target. Clear the preview to restore the green gauge and £280 current balance.
3. Start the weekly plan with a £50 buffer. Run the scheduled check. Show that £10 posted and £15 remains due.
4. Open Demo controls. Advance one week and change the available bank balance to £55. Run the next check and show why it skipped.
5. Ask for payment support. Review and confirm the editable message. Show reference AG-014, pending review and the £15 still due.

Demo controls can simulate stale or unavailable bank data, payment failure and support submission failure. Turn the support failure control off to retry the same draft. A scheduled payment runs once per demo week. Weeks advance the scheduler while the demo keeps the original statement and due date. All posted payments in the fixture count towards that statement minimum.

## Check the gauges

The web gauge previews the typed purchase without changing the account balance. With the default account, £20 reaches the 30% target (amber), £220 reaches half the limit (red), and £800 shows 108% with an over-limit warning. Only the bar width stops at 100%. Invalid input restores the current gauge and shows an error; Clear preview and Reset demo restore the starting values.

For the Chrome extension, load `checkout-guard` as an unpacked extension from `chrome://extensions` with Developer mode enabled. Its gauge measures the monthly budget: green below 80%, amber from 80% through 100%, and red above 100%. With a £300 budget, type £120, £240 and £360 into Current Month Spend and check the allowance and colour update immediately. Save Changes persists valid settings. Empty amounts, negative spend and a zero budget cannot be saved. Reset Demo restores £300/£120. Opening `checkout-guard/popup.html` outside the extension previews the same calculations without saving settings.

Open `checkout-guard/test-checkout.html` to check the projected checkout gauge; enable “Allow access to file URLs” in the extension details if opening the file directly. With £250 spent of a £300 budget, the £69.99 order shows red, 106.66% used and £0 remaining.

## Load the extension in Firefox

Use desktop Firefox 142 or newer. Chrome and Firefox use the same `checkout-guard` folder and manifest; no build step or separate extension source is needed. Budget settings are stored locally in each browser and do not sync between browsers.

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on…** and select `checkout-guard/manifest.json`.
3. Open **CheckoutGuard** from the extensions toolbar menu to set your budget and current spend, then click **Save Changes**.
4. To test locally, run `python3 -m http.server 4180 --bind 127.0.0.1` from the repository root and visit `http://127.0.0.1:4180/checkout-guard/test-checkout.html`.
5. Check the detected £69.99 order, projected gauge, countdown and Continue button. Turning the guard off in its popup suppresses warnings on newly loaded checkout pages.

After pulling updates, click **Reload** beside the extension on the debugging page and refresh the checkout tab. Temporary add-ons are removed when Firefox restarts; repeat the loading steps after restarting. Permanent installation requires Mozilla signing; this repository has not been submitted or published. See [Mozilla's temporary installation guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

Firefox validation: `npx web-ext lint --source-dir checkout-guard`. The manifest includes a stable Firefox ID and declares no collection or transmission of data outside the extension. Checkout totals are read locally and preferences stay in browser-local storage.

See `project-brief.md` for the pitch, six-slide outline and judge Q&A.
