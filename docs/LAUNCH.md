# Launching Adaptive Credit Guard

Three ways to run it, from quickest to most complete. Everything runs locally: no accounts, no server, no real bank.

| You want to… | Use | Needs |
|---|---|---|
| Show the dashboard with no setup | [Offline demo](#1-offline-demo-no-node) | Python 3 |
| Work on the code | [Dev server](#2-dev-server) | Node 20.19+ or 22.12+ |
| Accounts (register / log in / log out) | [Accounts server](#2b-accounts-server) | Node (nothing extra) |
| Show dashboard + extension together | [Dev server](#2-dev-server) + [extension](#3-load-the-checkoutguard-extension) | Chrome/Chromium or Firefox 142+ |

---

## 1. Offline demo (no Node)

The built site is committed in `dist/`.

```sh
cd WHACK26
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open <http://127.0.0.1:4173>. Port 4173 is one of the ports the extension syncs with, so the extension works here too.

> Don't double-click `index.html` or `dist/index.html`. A page opened as `file://` can't load its scripts or talk to the extension.

## 2. Dev server

```sh
cd WHACK26
nvm use        # optional: picks Node 22 from .nvmrc
npm ci         # first time, and after every pull that changes package-lock.json
npm run dev
```

Open <http://127.0.0.1:5173>. Edits reload instantly.

The dev server **always** uses port 5173. If something else is using it, you get `Port 5173 is already in use` instead of a silent move to another port, where the extension can't sync. Stop the other server (Ctrl+C in its terminal) and try again.

To refresh the offline demo after changing code:

```sh
npm run build   # rewrites dist/ – commit it, CI checks it is up to date
```

## 2b. Accounts server

Accounts need the small Node server in `server/` (no extra packages). It serves the built app **and** the accounts API on port 4173.

```sh
npm run build      # the server serves dist/
npm run server     # http://127.0.0.1:4173 – log in / create an account
```

Working on the UI with accounts: run `npm run server` in one terminal and `npm run dev` in another. The dev server on 5173 forwards `/api` to 4173.

Two-device demo: `npm run server -- --lan`, then open `http://<this-laptop's-IP>:4173` on the other device (plain HTTP, demo only).

- **No server running?** The app goes straight into **guest mode** (header: "Guest (accounts offline)") and works exactly as before. The Python offline demo always runs as guest.
- Each account's money data stays **in this browser**, separate per account. Guests use the original storage, so older demo data appears there.
- Accounts are saved in `server/data/users.json` (gitignored). Delete it to remove all accounts.

## 3. Load the CheckoutGuard extension

The extension is the `checkout-guard/` folder. It needs no build step.

**Chrome / Chromium / Edge / Brave**

1. Go to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `checkout-guard` folder.
4. Optional: pin it with the 🧩 puzzle icon.

After pulling new code or switching branch, click **↻ reload** on the CheckoutGuard card, then **refresh every open dashboard and shop tab**. Chrome doesn't put the reloaded extension into tabs that were already open, so those tabs stop syncing and Reset demo can't reach the extension.

**Firefox**

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and pick `checkout-guard/manifest.json`.

It's removed when Firefox closes, so load it again next time.

### Check the extension and dashboard are synced

1. Open the dashboard (5173, 4173 or 3000) in the **same browser profile** as the extension. Within a few seconds, check for **Extension connected · balance is synced** below the page introduction.
2. In another tab open <http://127.0.0.1:5173/checkout-guard/test-checkout.html> (dev server) — a fake shop that never charges anything.
3. The **Take a breath before you buy** popup appears with the dashboard's number: **Safe to spend now: £20.00** (fresh demo: you owe £280.00 of a £300.00 safe limit).
4. Wait for the timer, click **Continue to checkout**. The dashboard and both extension popups now say **Safe to spend £0.00** and "You owe £349.99 of your £300.00 safe limit". The popup stays away on that shop for 30 minutes.
5. Or click **Leave checkout** instead. The item appears in the dashboard's 30-minute reflection queue.

### Personalise the website and extension together

Open **⚙ Settings** → **Main balance number** to choose Safe to spend, Card limit remaining or What you owe. In a fresh demo these are **£20.00**, **£720.00** and **£280.00**. The selection also applies to the extension toolbar and checkout’s before/after figures, saves automatically and survives Reset demo. It works with Advanced Mode off too. The safe-limit gauge and warnings stay visible whichever number you choose. If the extension says the full limit is unavailable, open the website in the same browser profile to sync it.

Open **⚙ Settings** on the website. The large centred dialog has the existing theme, font and Detailed view switches. Enable **Advanced Mode** for:

- **Text size:** Standard, Larger or Largest.
- **Comfortable spacing:** more room around lines and controls.
- **Reduce motion:** no decorative animations or transitions. Device reduced-motion settings always apply.

Changes save automatically, survive refresh and **Reset demo**, and apply to the toolbar popup and checkout overlay in this browser profile. Turn Advanced Mode off to pause its effects; turn it back on to restore your choices. Escape, Done and × close the dialog. Tab stays inside until you close it.

Keep a dashboard tab open on an allowed port when changing settings. Then open the extension toolbar or the fake checkout in another tab to compare. Already-open extension popups update automatically; the shop page itself is unchanged. Reload the extension and refresh all tabs after updating the code. If storage is blocked, the website explains that choices may last only for this visit.

## 4. Run the checks

```sh
npm test                 # unit tests (Node only, ~1 s)
npm run lint:extension   # Mozilla's extension linter
npm run build            # production build into dist/
```

Full browser test (real Chromium, real extension, about 1 minute):

```sh
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-browser.txt
python -m playwright install chromium    # or set CHROMIUM_PATH=/usr/bin/chromium
npm run build && npm run test:browser
```

It starts its own servers. Ports 4173 or 3000 must be free.

Package the extension as a ZIP (for sharing or Firefox signing): `npm run pack:extension`, output in `web-ext-artifacts/`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Port 5173 is already in use` | Another dev server is running. Stop it (Ctrl+C), or find it with `lsof -i :5173`. |
| Extension shows a different "safe to spend" from the dashboard | The dashboard isn't open on 5173/4173/3000 in the same browser profile, or the extension wasn't reloaded after an update. |
| Purchase didn't reach the dashboard | It's queued in the extension and delivered when a dashboard tab opens (retries every 5 s). |
| Popup doesn't appear on the test shop any more | You pressed Continue/× there in the last 30 minutes, so that shop is approved. Press **Reset demo** on the dashboard (or **Reset** in the toolbar popup) and reload the shop. In Chrome, if you reloaded the extension, refresh the dashboard tab first or Reset demo can't reach it. |
| Dashboard and extension stopped syncing in Chrome after reloading the extension | Refresh the dashboard tab and the shop tab. |
| Popup never appears on a real shop | Detection is deliberately strict to avoid false alarms. Use the test checkout page, or check `chrome://extensions` → CheckoutGuard → **Errors**. |
| `npm ci` errors about the lockfile | You're on an old branch. Pull, then run `npm ci` again. |
| Blank page | You opened a `file://` URL. Use one of the servers above. |
| Want a clean demo | Click **Reset demo** in the dashboard header. |
| Stuck on "Log in" / "Accounts aren't available" | The accounts server isn't running. Start `npm run server`, or click **Continue without an account**. |
| "Too many attempts" | 5 wrong passwords for that username: wait 15 minutes or restart the server. |
| Forgot a demo password | Stop the server, delete `server/data/users.json` (removes **all** accounts), start it again. |
| Font, theme, detailed view, text size, spacing or motion | **⚙ Settings** in the dashboard header. Advanced Mode reveals extra choices. All effective choices also apply to both extension popups. Reload the extension and refresh tabs after a code update. |

### If a checkout still does not appear

Check the connection line on the dashboard first. **Extension not connected** means the dashboard has not received confirmation of its current numbers. In Chrome, open the CheckoutGuard extension’s details and ensure site access allows both the local dashboard and the shop (for the demo, **On all sites**). Check that the unpacked extension path points to this checkout’s `checkout-guard` folder. Reload it, then refresh every dashboard and shop tab. In Firefox, reload the temporary add-on and refresh both tabs.

The handshake retries every five seconds and when you return to the dashboard. A connected status confirms the money snapshot reached the extension, rather than merely that a script was detected. If the line says connected but a purchase is missing, use the fake checkout and inspect the dashboard’s visible storage error and the shop’s “Could not save the checkout” message. Continue remains a planned checkout entry, not confirmation that a real order was paid.

## Bank statement images and scanned PDFs

After updating packages run `npm ci`, then restart `npm run dev`. The npm startup/build hooks prepare the OCR worker, WASM engines and English data locally. For an offline demo use the freshly rebuilt `dist/` folder, which includes `dist/ocr/`; no CDN is needed.

Open **Menu → Statement analysis** and choose a GBP **PDF, JPG or PNG** (20 MB maximum). Wait for the local progress message, or use **Cancel reading**. Images/scanned PDFs may take longer than text PDFs. Limits are 100 PDF pages and at most 15 scanned pages needing OCR.

Uploads and the sample-statement button now open **Review before importing**. Nothing from that file changes Home or the balance until **Confirm and import selected**. Check dates, outgoing amounts and descriptions, correct categories, untick uncertain rows or use **Add a missing row**. Zero-value or low-confidence rows start unselected. Confirm the review checkbox only after checking the original. Cancel keeps your previous saved statement. Reset also cancels any active OCR job and clears its draft.

A partial page, unreadable heading, blank template, old date or inconsistent example can produce missing/uncertain rows. Do not use opening/closing balances as transaction amounts or assume a mismatched total is an OCR bug. Improve image quality or correct the draft against all original pages. All-zero templates can be reviewed but are not imported as spending unless you enter real positive amounts.

For automated checks, with the existing browser-test Python environment and Chromium installed:

```sh
npm run build
python scripts/check-statement-ocr.py
```

Optional image file paths can be appended to check that your local examples reach review; they are not stored in the repository. The test also covers a generated scanned PDF and verifies that OCR makes no external requests.

### Try Focus mode
On Home, choose **Focus mode** beside “One thing at a time”. Use **Next** and **Back**
to move at your own pace. **Close focus mode** or Escape returns to Home. The final
step offers **Review recorded spending**, **Try a purchase amount**, or **Finish for
now**. With a reset demo the first facts show £280.00 owed and £20.00 safe to spend;
without current-month selected transactions, the spending step says “No transactions
recorded”. Uploads remain subject to review before appearing here. No data leaves the
device and Focus mode does not save a separate history.

Automated Focus mode checks (after `npm run build`, using the browser-test Python
environment): `python3 scripts/check-focus.py`. Set `CHROMIUM_PATH` if using an
existing Chromium binary. This covers modal navigation, keyboard focus, reset,
empty data, optional actions and mobile layout in both themes.

Focus mode opens with “Take a breather.” and an optional breathing guide. Start
plays an expanding/shrinking circle with four-second in/out prompts; Pause stops it.
“Show my summary” skips the guide immediately. Closing, Escape, leaving the welcome
step or Reset demo stops its timer. Both system and app reduced-motion settings keep
the circle still while the words change. No breathing history is recorded.
