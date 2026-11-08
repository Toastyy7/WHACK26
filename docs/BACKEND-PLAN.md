# Backend plan: accounts (register, log in, log out)

**Status:** plan only. No code written yet. Branch: `docs/rust-backend-plan`. Implementation goes on a new `feature/accounts` branch (Emil's Laws).

## Decisions so far

| Question | Decision |
|---|---|
| Why a backend? | **User accounts:** register, log in, log out |
| What belongs to an account? | **Login only on the server.** Money data (transactions, reflection queue) stays **in the browser**, kept **separate per account** |
| Where does it run? | **Locally** for the demo (presenter's laptop; optionally a second device over Wi-Fi) |
| Language | **Node, zero new packages** (`node:http`, `node:crypto`, `node:fs`, `node:test`) |
| Features | **Register, log in, log out** (no password reset, email, or account settings) |
| Guest mode (use the app without an account)? | **❓ Open question.** See section 8 |

Why not Rust: see [section 9](#9-why-node-and-not-rust). Short version: every teammate would need to install Rust (1–1.5 GB, plus VS C++ tools on Windows), and only Rust-confident people could fix it at 3am. Node is already installed for everyone and is the same language as the app.

---

## 1. What changes for the user

1. Opening the dashboard shows **Log in** / **Create account** (unless already logged in).
2. After logging in, the dashboard works exactly as today. The header shows **"Signed in as emil"** and a **Log out** button.
3. Each account has **its own** transactions, reflection queue and saved statement on that browser. Two people sharing a laptop don't see each other's numbers.
4. Display settings (dark mode, detailed view, OpenDyslexic font) stay **per browser**, as now.
5. **CheckoutGuard (the extension) doesn't change.** It syncs with whichever account is logged in on the open dashboard tab. Purchases made while nobody is logged in wait in the extension and go to the next account that logs in on that browser.

## 2. Privacy (keep the pitch true)

- The server stores **only**: user ID, username, password **hash** (never the password), and login sessions.
- **No balances, transactions, statements or purchases ever go to the server.** The pitch line becomes: *"Your account lives on our server; your money data never leaves your device."*
- Everything else from [PROJECT.md → Privacy](PROJECT.md#privacy-and-security) still holds.

---

## 3. Architecture

```
Browser (dashboard)                         server/ (Node, port 4173)
┌─────────────────────────────┐   /api/*    ┌──────────────────────────────────┐
│ AuthScreen (log in/create)  │────────────▶│ register / login / logout / me    │
│ App (only when logged in)   │◀────────────│ HttpOnly session cookie           │
│ localStorage keys per user: │  cookie     │ server/data/users.json (gitignored)│
│  credit-guard-statement-v1:<userId>        │ also serves dist/ (the built app) │
└─────────────────────────────┘             └──────────────────────────────────┘
      ▲ extension bridge unchanged (port 4173 is already allowed in sync.js)
      └── CheckoutGuard
```

- **One origin, no CORS.** The server serves the built app (`dist/`) **and** `/api` on `http://127.0.0.1:4173`. In development, Vite (port 5173) proxies `/api` to it, so the cookie is first-party in both cases.
- **Port 4173** is already in the extension's allowlist, so the extension needs **no change**.
- **Storage:** one JSON file `server/data/users.json` (gitignored), written to a temp file and renamed, so a crash can't corrupt it. Fine for demo scale (tens of users). If it ever needs more: `shortcut: JSON file store, upgrade to SQLite if >1,000 users or multiple servers`.

## 4. API

All requests and responses are JSON. Errors are `{ "error": "<plain-English message>" }`.

| Method + path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/health` | — | `200 {ok:true}` | — |
| `POST /api/register` | `{username, password}` | `201 {user:{id, username}}` + sets cookie (logged in) | `400` invalid input · `409` username taken |
| `POST /api/login` | `{username, password}` | `200 {user}` + sets cookie | `401` "Username or password is wrong" · `429` too many attempts |
| `POST /api/logout` | — | `204` + clears cookie, deletes session | — (always succeeds) |
| `GET /api/me` | — | `200 {user}` | `401` not logged in |

Rules:
- **Username:** 3–32 characters, `a–z 0–9 . _ -`, stored lowercase, unique.
- **Password:** 8–128 characters (NIST guidance: length over complexity rules).

## 5. Security (non-negotiable, even for a demo)

| Concern | How |
|---|---|
| Password storage | `crypto.scrypt` (N=16384, r=8, p=1, 64-byte key) with a random 16-byte salt per user. Compare with `crypto.timingSafeEqual`. Never log or return passwords or hashes. |
| Sessions | Random 32-byte token (`crypto.randomBytes`) in cookie `cg_session`: **HttpOnly, SameSite=Lax, Path=/**, 7-day expiry. The server stores only the **SHA-256 of the token**, so a leaked data file can't be used to log in. |
| CSRF | SameSite=Lax cookie, **plus** `POST` must have `Content-Type: application/json` and an `Origin` that matches the server (or the Vite dev origin). |
| Brute force | Max 5 failed logins per username + IP per 15 minutes → `429`. In memory; resets when the server restarts (acceptable for a demo). |
| User enumeration | Login gives the same message for an unknown user and a wrong password, and still runs scrypt for unknown users so timing is similar. (Register must reveal "taken"; that's acceptable.) |
| Input | Body ≤ 16 KB, strict JSON parsing, every field validated. |
| Exposure | Binds to `127.0.0.1` by default. `npm run server -- --lan` binds to `0.0.0.0` for the two-device demo (print a warning). |
| HTTPS | Not on localhost. Documented as **demo only, never deploy as-is**. A hosted version would need HTTPS and the `Secure` cookie flag. |
| Secrets | None needed. `server/data/` is gitignored, so user data is never committed. |

---

## 6. Implementation steps

On a new `feature/accounts` branch, one commit per step, test first (Emil's Laws).

| # | Step | New files | Existing code touched |
|---|---|---|---|
| 1 | Server skeleton: `node:http`, serves `dist/` (SPA fallback) + `GET /api/health`; `--lan` flag | `server/index.js` | `.gitignore` (+`server/data/`), `package.json` (+`"server": "node server/index.js"`) |
| 2 | User store: load/save JSON atomically, scrypt hash/verify | `server/store.js`, `server/store.test.js` | — |
| 3 | Register / login / logout / me, sessions, rate limit, origin check | `server/auth.js`, `server/auth.test.js` (starts the server on port 0 and calls the real endpoints) | — |
| 4 | Dev proxy: `/api` → `127.0.0.1:4173` | — | `vite.config.js` (3 lines) |
| 5 | Front-end client + hook: `api.js` (`fetch` with `credentials:'same-origin'`, 5 s timeout), `useAuth()` (`me` on load, `login`, `register`, `logout`) | `src/auth/api.js`, `src/auth/useAuth.js`, tests | — |
| 6 | Log-in / create-account screen: labels, `autocomplete="username"` / `current-password` / `new-password`, errors announced with `role="alert"`, show/hide password, works with the OpenDyslexic font | `src/components/AuthScreen.jsx` | `src/style.css` (a few rules) |
| 7 | Gate the app: loading → AuthScreen → App. Header shows "Signed in as …" + **Log out**. `key={user.id}` on the app so each account's data reloads cleanly | — | `src/App.jsx`, `src/main.jsx` |
| 8 | **Per-account storage:** add `:<userId>` to the three data keys (`credit-guard-statement-v1`, `credit-guard-cooling-v1`, `credit-guard-checkout-receipts-v1`) | — | `src/statements/storage.js`, `src/coolingQueue.js`, `src/statements/checkoutSync.js`, `src/hooks/useSavedStatement.js`, `src/hooks/useCoolingQueue.js` (pass the user ID through) |
| 9 | Tests: two accounts on one browser see separate data; logout hides data; browser test: create account → dashboard → log out → log in → same data | — | `scripts/check-browser.py` (start the server instead of the plain file server), existing storage tests |
| 10 | Docs + Emil's Laws: how to run, the API, security notes, privacy line for the pitch | — | `docs/LAUNCH.md`, `docs/PROJECT.md`, `AGENTS.md`, `project-brief.md` (one Q&A line) |
| 11 | Test checklist for the user (Emil's Laws, Step 4), then push the branch → PR | — | — |

**Not touched:** the extension (`checkout-guard/`), the money model, the bridge, Request Grace, statements parsing, the settings menu, CI config (server tests run automatically: `node --test` finds `server/*.test.js`).

**Effort:** about 3–5 hours including tests and docs.

---

## 7. How teammates run it

Nothing new to install. From the repo:

```sh
npm ci
npm run build        # the server serves dist/
npm run server       # http://127.0.0.1:4173  (accounts + app)
```

While developing the UI, run both:

```sh
npm run server       # terminal 1 (API on 4173)
npm run dev          # terminal 2 (http://127.0.0.1:5173, /api proxied to 4173)
```

Two-device demo: `npm run server -- --lan`, then open `http://<presenter-ip>:4173` on the second device. Venue Wi-Fi may block this, so the fallback is two browser windows on one laptop.

---

## 8. ❓ Open question: guest mode

Right now the plan **requires the server for the dashboard to work at all**. That breaks:
- the **offline demo for judges** (`python3 -m http.server … dist`): it has no `/api`, so it would be stuck on the login screen;
- any demo where the server crashes or isn't started.

**Recommendation:** add **"Continue without an account"** (guest). It's the current behaviour, using today's un-suffixed storage keys, and it's shown automatically if the server can't be reached. About 30 extra minutes, and it removes the biggest demo-day risk. **Needs your yes/no before step 7.**

---

## 9. Why Node and not Rust

| | Rust (axum + argon2 + rusqlite) | **Node, zero packages (chosen)** |
|---|---|---|
| Extra install per teammate | `rustup` 1–1.5 GB; Windows also needs VS C++ Build Tools | **None** |
| First run | 1–3 min compile | Instant |
| Who can fix it | Rust-confident people only | Everyone (same language as the app) |
| Password hashing | `argon2` crate | Built-in `crypto.scrypt` (also a recommended KDF) |
| New dependencies | ~100 crates | **0** |
| Performance | Excellent (irrelevant at demo scale) | Plenty |

We'd revisit Rust only if a teammate already knows it **and** we want it as a judging talking point.

---

## 10. Risks

- **Demo depends on the server** (unless guest mode is added, see section 8).
- **Shared laptop:** the extension follows whichever account is logged in on the dashboard tab. Purchases made while logged out go to the next account that logs in on that browser. Documented, acceptable for a demo.
- **Existing saved demo data** (un-suffixed keys) won't appear inside a new account. Either it becomes the guest data (if guest mode) or Reset demo clears it.
- **Not production-ready:** no HTTPS, password reset, email, or account deletion. Fine for a hackathon, but say so if judges ask.
