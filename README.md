# Adaptive Credit Guard

Hackathon prototype for Capital One's *Making Credit Accessible* challenge: a simulated UK credit card dashboard plus **CheckoutGuard**, a Chrome/Firefox extension that pauses impulsive checkouts and keeps both in sync. Everything runs locally in the browser; no real bank, lender or payment is involved.

```sh
npm ci && npm run dev          # http://127.0.0.1:5173
# or, without Node:
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Then load `checkout-guard/` as an unpacked extension.

| Doc | Read it to… |
|---|---|
| [AGENTS.md](AGENTS.md) | **Emil's Laws. AI agents, read first:** branch rules, questions to ask, test checklist, pull requests |
| [docs/LAUNCH.md](docs/LAUNCH.md) | run the app and extension, run the tests, fix common problems |
| [docs/PROJECT.md](docs/PROJECT.md) | understand features, money rules, sync protocol, stored data and every file |
| [docs/REPO-FIX.md](docs/REPO-FIX.md) | clean up the repo and the team's git workflow |
| [docs/BACKEND-PLAN.md](docs/BACKEND-PLAN.md) | plan: accounts backend (register / log in / log out), Node vs Rust |
| [project-brief.md](project-brief.md) | pitch, 90-second demo script, judge Q&A |

**Rule:** never commit to `main`. Use a branch and a pull request (see REPO-FIX.md).

### Local OCR and review before import

JPG/PNG images and image-only PDF pages now use bundled, local OCR. Nothing is sent to an OCR service. `npm ci` followed by `npm run dev` prepares the required assets; rebuild `dist/` before using the offline demo.

All uploads, including text PDFs and the sample statement, first open **Review before importing**. Correct dates, amounts and descriptions, choose existing categories, exclude unclear rows or add missing ones. Confirm the review checkbox, then import the selected rows. Until then Home and the balance stay unchanged. Cancel keeps the previous saved statement; Reset cancels reading and clears drafts and confirmed results.

OCR is imperfect, especially for blurry images and template amounts. Incomplete pages, mismatches and all-zero results are flagged rather than filled in with invented transactions. Original images/PDFs are not saved. See `docs/LAUNCH.md` for limits and the OCR browser test.
