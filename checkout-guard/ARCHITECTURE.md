# CheckoutGuard architecture

One Manifest V3 extension folder works in Chrome and desktop Firefox 142+. It is loaded directly or packaged with `npm run pack:extension`; no bundler, background worker, remote API or polyfill is needed.

## Files

- `manifest.json`: popup, CSS and content scripts, storage permission and Firefox identity/data declaration. `core.js` loads before `content.js`.
- `core.js`: integer-pence parsing, GBP-only total parsing, setting validation/defaults, budget bands and storage access. Firefox uses `browser` promises; Chrome uses callbacks and checks `runtime.lastError`. Errors reject instead of reporting a successful save.
- `content.js`: checkout detection, total extraction, dialog lifecycle and navigation/storage observation.
- `content.css`: styles scoped to the injected overlay, visible keyboard focus, small-screen scrolling and reduced motion.
- `popup.html`, `popup.css`, `popup.js`: settings editor, live preview, separate on/off control, saved/unsaved state and retryable errors.
- `test-checkout.html`: inert local checkout fixture. It never submits a payment.

## Settings and calculations

Persisted keys remain compatible with the original prototype: `isEnabled`, `monthlyBudget`, `currentSpent` and `cooldownSeconds`. Amounts are stored in pounds for compatibility but converted to integer pence for every calculation. Budgets must be positive, spending non-negative, and amounts have at most two decimals. A stored reflection pause must be an integer from 1 to 300 seconds; the popup offers 10/15/30/60 seconds. Invalid stored fields receive defaults; invalid form submissions are rejected.

One shared calculation powers popup and checkout gauges: green below 80%, amber up to 100%, red above 100%. The actual percentage is never clamped; bar width and the meter's numeric value are capped at 100 and accessible text retains the full percentage and warning.

These monthly-budget bands are independent of the web dashboard's credit-limit target. There is no claim that either gauge predicts a credit score. The extension and dashboard do not share state or pretend to connect to a bank.

## Checkout detection and totals

General detection requires a score of at least 10 and at least two categories: visible checkout containers, explicit routes, payment-field presence, final-order buttons and visible total elements. Product/search guardrails and excluded hostnames reduce false positives. Hostnames use domain boundaries, not substring matches. Amazon has separate explicit checkout-route/header and place-order checks; a persistent navigation cart no longer suppresses a confirmed checkout.

Only field presence is inspected; card-number/CVV values are not read. Only visible total elements outside the extension overlay are considered. An explicit total takes precedence; a foreign-currency total cannot fall through to a GBP product price elsewhere. The fallback accepts labels starting with Total, Order total, Grand total or Estimated total, not Subtotal. Ambiguous amounts or other currencies produce no projection. The user may type a GBP amount instead. There is no invented purchase price or FX conversion.

## Lifecycle

The content script loads settings once and subscribes to relevant local storage changes. Read failures do not activate a guessed budget. A guarded refresh scans after external DOM changes, including text-node changes. Changes inside the extension's own UI are ignored to avoid observation loops or repeated screen-reader announcements. A lightweight URL check covers SPA `pushState` and `replaceState` without modifying a site's History API. Navigating away from a checkout closes its dialog.

An order is identified in memory by its current URL and detected pence total. Changing the total or URL creates a new preview and pause. Changing settings updates the existing preview; turning the guard off closes it. Continue, Close and Escape dismiss that order for the life of the page. A new total may warn again; unrelated page mutations cannot restart a dismissed warning.

The timer uses an absolute deadline, so throttled background tabs do not artificially extend the reflection period. Timers and keyboard/focus listeners are removed when a dialog closes. The dialog traps Tab, supports Escape, and restores the previous focus. It is a reflection aid, not a payment blocker or order cancellation mechanism.

Dynamic values are assigned with `textContent`, DOM properties or numeric styles; the overlay HTML template is static. No page content or stored strings are interpolated into HTML. Popups never overwrite unread settings: a failed load disables editing and offers Retry. A failed save preserves edits. The on/off switch saves only its own field and is independent of invalid budget drafts.

## Validation

`npm test` covers account rules, currency parsing, penny boundaries, corrupt settings, storage API differences and error propagation. `npm run test:browser` uses Playwright/Chromium and simulated extension storage for real UI/DOM flows. Tests start a temporary HTTP server and check nested offline hosting, purchase previews, target controls, payments, support, live totals, manual amounts, settings changes, disabled guards, failed reads/saves, focus and dismissal.

`npm run lint:extension` validates the same source with Mozilla's linter. `npm run pack:extension` excludes fixture/documentation files and produces an unsigned ZIP. Temporary Firefox installation can exercise real storage/content-script isolation; permanent Firefox installation requires Mozilla signing.

All preferences are local to each browser. There is no network transmission of shopping details or synchronisation with the web demo. There are no real banking credentials, payments, support messages or analytics.
