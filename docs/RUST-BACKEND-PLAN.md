# Rust backend: evaluation and plan

**Status:** proposal only. No code written. Branch: `docs/rust-backend-plan`.
**Question asked:** should we add a Rust backend, and if so, how do we do it as easily as possible while touching existing code as little as possible?

---

## TL;DR: verdict

**A general backend is a bad idea for this hackathon. Rust makes it worse for the team, not better.**

- The app **doesn't need a server.** Every feature already works in the browser, and "your data never leaves your device" is one of our strongest privacy points for judges ([PROJECT.md → Privacy](PROJECT.md#privacy-and-security)). A backend that stores money data weakens that story.
- **Rust is expensive for teammates to run.** Each person needs `rustup` (about 1–1.5 GB) and a first compile of a web stack (about 1–3 min), and Windows users also need the Visual Studio C++ build tools (several GB). Everyone already has Node, so a Node server costs nothing extra.
- **There is one good reason for a server:** a **simulated lender inbox** for Request Grace. Our own brief asks for "a simulated lender inbox" and a "support review panel". A small server lets us demo **two screens**: the customer sends a request, and a "lender" laptop sees it and replies. That's a real demo upgrade.

**Recommendation:**
1. **Don't build a general backend.**
2. **If you want the lender-inbox demo, build a tiny optional server** that does only that. The app must keep working with the server switched off.
3. **Build it in Node, not Rust,** unless someone on the team already knows Rust *and* wants it as a talking point. Below is the plan for both. The Rust plan is designed to touch as little existing code as possible.

---

## 1. What would a backend actually do?

| Idea | Needs a server? | Worth it now? |
|---|---|---|
| Store balances / transactions | No: localStorage already does it | ❌ Hurts the privacy pitch |
| Parse statement PDFs | No: PDF.js already does it in the browser | ❌ Uploading statements is a privacy step backwards |
| Sync dashboard ↔ extension | No: the bridge already does it, offline | ❌ Would add host permissions and failure modes |
| Real bank / Open Banking | Yes, but needs licences, keys and OAuth | ❌ Out of scope for a hackathon |
| **Simulated lender inbox** (Request Grace goes to a lender view that can accept/decline) | **Yes:** two people, two devices | ✅ **Only real candidate** |
| Share demo state between judges' devices | Yes | ⚠️ Nice-to-have, same server as above |

So the only scope worth planning is: **a small optional "lender inbox" server**, and nothing else.

---

## 2. Rust vs alternatives

| | **Rust (axum)** | **Node (built-in `node:http`, no packages)** | **No server (status quo)** |
|---|---|---|---|
| Extra install for teammates | `rustup` 1–1.5 GB; Windows + VS Build Tools | **None** (Node is already required) | None |
| First run | `cargo run`: 1–3 min compile, then fast | `npm run server`: instant | — |
| Lines of server code | about 150–200 | about 80–120 | 0 |
| Team can read and change it | Only Rust-experienced people | Everyone (same language as the app) | — |
| Performance | Excellent, but irrelevant at demo scale | Plenty for a demo | — |
| CI cost | New job, +2–4 min with caching | Same job as now | — |
| "Wow" for judges | Small (judges see the UI, not the server) | Small | — |
| Risk on demo day | Toolchain/compile issues on a teammate's laptop | Low | Lowest |

**Rust is the right choice only if** (a) someone already knows Rust well, (b) the team wants "we used Rust" as a deliberate talking point, and (c) at most one laptop needs to run it on demo day (it can run on the presenter's laptop and others connect over Wi-Fi).

### Middle option: Rust without a server (WebAssembly)
If the real goal is "use Rust", it could run **in the browser** as WebAssembly, for example the safe-to-spend maths or the statement parser. That keeps the privacy story intact. But it adds `wasm-pack` to every build, and the extension can't easily share it (no build step), so the dashboard/extension contract gets harder. **Not recommended** for now either.

---

## 3. Design (if we go ahead): smallest possible footprint

**Principle:** the server is **optional**. If it isn't running, the app behaves exactly as it does today (the simulated Request Grace flow). Nothing in the extension changes.

```
customer laptop                      presenter/lender laptop (or same laptop)
┌──────────────────────┐   HTTP     ┌───────────────────────────────┐
│ Dashboard (React)    │──────────▶│ server/ (Rust axum or Node)    │
│ Request Grace ──────▶│ /api/...  │  • serves dist/ on :4173       │
│ (falls back to the   │◀──────────│  • /api/grace-requests         │
│  current simulation) │            │  • JSON file storage           │
└──────────────────────┘            │  • /lender page (inbox)        │
     ▲  extension bridge unchanged   └───────────────────────────────┘
     └── CheckoutGuard (no changes)
```

- **Port 4173.** The extension's sync allowlist already includes it, so serving the built dashboard from the server needs **no extension change**.
- **Storage:** one JSON file (`server/data/requests.json`, gitignored). No database.
- **Only Request Grace data** goes to the server: reference, message text, status, timestamps. **No balances, transactions or statements.**
- Bound to `127.0.0.1` by default. `--lan` exposes it to other devices for the two-laptop demo.

### API (5 endpoints)

| Method + path | Purpose |
|---|---|
| `GET /api/health` | Lets the dashboard detect the server (200 → use it, else fall back) |
| `POST /api/grace-requests` `{message}` | Create a request → `{id, status: "submitted", createdAt}` |
| `GET /api/grace-requests/:id` | Customer polls their request status |
| `GET /api/grace-requests` | Lender inbox list |
| `POST /api/grace-requests/:id/decision` `{decision: "accepted"\|"declined", reply}` | Lender decides (replaces today's random decision) |

Validation: message 1–1500 characters (same as the textarea), decision from a fixed list, unknown IDs → 404, JSON body ≤ 16 KB. No auth; it's a local demo (say so in the docs).

---

## 4. Implementation plan (Rust version)

Each step is a separate commit on a `feature/lender-inbox-server` branch (per Emil's Laws).

| # | Step | Files | Touches existing code? |
|---|---|---|---|
| 1 | Create `server/` Cargo project: `axum`, `tokio`, `serde`, `serde_json`, `tower-http` (static files). Health endpoint + serve `../dist` with SPA fallback. | `server/Cargo.toml`, `server/src/main.rs`, `.gitignore` (+`server/target/`, `server/data/`) | `.gitignore` only |
| 2 | Grace request endpoints + JSON file store (`Mutex` + write-temp-then-rename so a crash can't corrupt it). | `server/src/main.rs` (+`store.rs`) | No |
| 3 | `cargo test` for each endpoint (status codes, validation, persistence round-trip). | `server/src/*.rs` | No |
| 4 | Lender inbox page: one static `server/static/lender.html` (plain HTML+JS, no React), list + accept/decline. | `server/static/lender.html` | No |
| 5 | Dashboard client: `src/graceApi.js` (fetch with 2 s timeout, `isAvailable()`), plus unit tests with a fake fetch. | new files | No |
| 6 | Use it in Request Grace: on send, if the server is available, POST and poll status every 3 s; otherwise keep the current simulated flow. Show "Sent to lender inbox" vs "Demo mode". | `src/components/RequestGrace.jsx` (one branch around `send()` and the status button) | **Yes, 1 component** |
| 7 | Dev convenience: Vite proxy `/api` → `127.0.0.1:4173` so `npm run dev` works with the server. | `vite.config.js` (3 lines) | **Yes, config** |
| 8 | Scripts: `"server": "cargo run --release --manifest-path server/Cargo.toml"`. | `package.json` | **Yes, 1 line** |
| 9 | CI: separate `rust` job (`dtolnay/rust-toolchain`, `Swatinem/rust-cache`, `cargo test`). The JS job is untouched. | `.github/workflows/check.yml` | Adds a job |
| 10 | Docs: LAUNCH (how to run, two-laptop demo), PROJECT (API, privacy note), AGENTS (server rules). | `docs/*`, `AGENTS.md` | Docs |

**Existing code touched in total:** `RequestGrace.jsx`, `vite.config.js`, `package.json`, `.gitignore`, the CI file, docs. **The extension, money model, bridge and all other components are untouched.**

**Effort:** about half a day for someone comfortable with Rust/axum; a day or more otherwise. The Node version of steps 1–4 is about 1–2 hours.

### Node version (recommended if we build it)
Same API, same design, same steps 5–10. Steps 1–4 become one file, `server/index.js`, using only `node:http`, `node:fs` and `node:test`, with **zero new dependencies**. Run with `npm run server`. Nobody installs anything new.

---

## 5. How easy is it for the others to run?

| | Rust | Node |
|---|---|---|
| One-time setup | macOS/Linux: `curl https://sh.rustup.rs -sSf \| sh`. Windows: rustup-init.exe **plus** "Desktop development with C++" (VS Build Tools) | Nothing |
| Each time | `npm run server` (first time compiles 1–3 min) | `npm run server` |
| Laptops that must run it on demo day | One (presenter); others open `http://<presenter-ip>:4173` | Any |
| If it breaks | The app still works in "demo mode" (simulated Request Grace) | Same |

---

## 6. Risks

- **Privacy pitch:** keep the server to Request Grace data only and say so on screen ("Sent to the demo lender inbox on this laptop"). Never send balances or statements.
- **Two code paths** in Request Grace (server vs simulation). Mitigated by tests for both and a visible mode label.
- **Demo-day networking:** venue Wi-Fi may block device-to-device traffic. Fallback: both screens on one laptop (two browser windows).
- **Rust learning curve** for teammates fixing bugs at 3am. Biggest reason to prefer Node.
- **CI time** +2–4 min for the Rust job.

---

## 7. Questions to answer before any code (Emil's Laws, Step 1)

1. **Why do we want a backend?** Lender-inbox demo, "we used Rust" for judges, learning, or something else?
2. Is the **two-screen lender demo** (customer sends → lender accepts/declines) something we'd actually show?
3. **Rust or Node?** Does anyone on the team already know Rust/axum?
4. What do teammates run: **Windows, macOS or Linux**? Do they have Rust installed?
5. Should the server **only** hold Request Grace data (recommended), or anything else?
6. Demo setup: **one laptop** or **two devices** over Wi-Fi?
7. Is it OK that Request Grace shows **"Demo mode"** when the server isn't running?
8. Does `project-brief.md` (pitch + judge Q&A) need a line about the server and privacy?

**Next step:** answer the questions above. If it's a "go", create `feature/lender-inbox-server` from the latest `main` and follow section 4 step by step, with a test checklist at the end (Emil's Laws, Step 4).
