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
| [project-brief.md](project-brief.md) | pitch, 90-second demo script, judge Q&A |

**Rule:** never commit to `main`. Use a branch and a pull request (see REPO-FIX.md).
