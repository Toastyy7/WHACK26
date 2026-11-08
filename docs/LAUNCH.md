# Launching Adaptive Credit Guard

Three ways to run it, from quickest to most complete. Everything runs locally: no accounts, no server, no real bank.

| You want to… | Use | Needs |
|---|---|---|
| Show the dashboard with no setup | [Offline demo](#1-offline-demo-no-node) | Python 3 |
| Work on the code | [Dev server](#2-dev-server) | Node 20.19+ or 22.12+ |
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

1. Open the dashboard (5173, 4173 or 3000) in the **same browser profile** as the extension.
2. In another tab open <http://127.0.0.1:5173/checkout-guard/test-checkout.html> (dev server) — a fake shop that never charges anything.
3. The **Take a breath before you buy** popup appears, showing the dashboard's numbers (£0.00 of £300.00 on a fresh demo).
4. Wait for the timer, click **Continue to checkout**. Both the dashboard and the extension now say **£230.01 left to spend this month**, "Owed on card" goes up by the order amount (£280.00 → £349.99), and the popup stays away on that shop for 30 minutes.
5. Or click **Leave checkout** instead. The item appears in the dashboard's 30-minute reflection queue.

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
| Extension shows a different "left to spend" from the dashboard (e.g. £120 of £300 spent) | The dashboard isn't open on 5173/4173/3000 in the same browser profile, or the extension wasn't reloaded after an update. |
| Purchase didn't reach the dashboard | It's queued in the extension and delivered when a dashboard tab opens (retries every 5 s). |
| Popup doesn't appear on the test shop any more | You pressed Continue/× there in the last 30 minutes, so that shop is approved. Press **Reset demo** on the dashboard (or **Reset** in the toolbar popup) and reload the shop. In Chrome, if you reloaded the extension, refresh the dashboard tab first or Reset demo can't reach it. |
| Dashboard and extension stopped syncing in Chrome after reloading the extension | Refresh the dashboard tab and the shop tab. |
| Popup never appears on a real shop | Detection is deliberately strict to avoid false alarms. Use the test checkout page, or check `chrome://extensions` → CheckoutGuard → **Errors**. |
| `npm ci` errors about the lockfile | You're on an old branch. Pull, then run `npm ci` again. |
| Blank page | You opened a `file://` URL. Use one of the servers above. |
| Want a clean demo | Click **Reset demo** in the dashboard header. |
