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

## Demo in 90 seconds

1. Start at Alex’s standard dashboard with £280 used out of £1,000 and £25 due on 14 November.
2. Turn on Adaptive Mode. Enter £50 in the purchase preview. Show the projected £330, 33% and £30 above Alex’s target. Clear the preview.
3. Start the weekly plan with a £50 buffer. Run the scheduled check. Show that £10 posted and £15 remains due.
4. Open Demo controls. Advance one week and change the available bank balance to £55. Run the next check and show why it skipped.
5. Ask for payment support. Review and confirm the editable message. Show reference AG-014, pending review and the £15 still due.

Demo controls can simulate stale or unavailable bank data, payment failure and support submission failure. Turn the support failure control off to retry the same draft. A scheduled payment runs once per demo week. Weeks advance the scheduler while the demo keeps the original statement and due date. All posted payments in the fixture count towards that statement minimum.

See `project-brief.md` for the pitch, six-slide outline and judge Q&A.
