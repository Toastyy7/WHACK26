# Adaptive Credit Guard
*Capital One hackathon · Making Credit Accessible · UK concept · Rough draft*

## Submission summary

Adaptive Credit Guard is a credit card dashboard. It shows what a purchase would do to your balance and lets you ask for repayment support in writing. It’s designed around barriers some people with dyscalculia, ADHD or executive dysfunction, and phone anxiety encounter when managing credit. The options are available immediately without disclosing a diagnosis.

**Pitch hook:** Meet Alex. They get paid on the 1st, their credit card payment is due on the 14th, and when money gets tight they put off making a phone call. The app shows them a balance and a deadline. It could also show them what to do next.

**Why Capital One:** This is about making credit easier to manage after approval. A clearer purchase preview and an accessible route to support could help customers act earlier. A pilot would test whether that translates into fewer missed minimum payments and more completed support requests.

## What we’re building

| Feature | Customer experience | Demo boundaries |
|---|---|---|
| Safe-Zone Gauge | Show the balance in pounds, the share of the limit used and a plain-language label. A purchase preview updates the projected balance and tells the customer when they cross their selected target. | Use a sample 30% target. Display “Within your target” below 30%, “Above your target” from 30% to under 50%, and “Using at least half your limit” from 50%. These are interface bands. No credit-score prediction. |
| Request Grace | Tap “Ask for payment support”, preview and edit a short message, then confirm. Get a reference and follow updates in writing. | Send to a simulated lender inbox. Show “Request received · awaiting review”. Keep the due date and amount visible until the lender confirms an arrangement. |

### Screen copy

- **Purchase preview** — “A £50 purchase would take your balance to £330 of £1,000 (33%). That’s £30 above your £300 target.” Keep the current balance visible beside the preview. Provide “Clear preview”.
- **Support draft** — “I may struggle to make my payment due on the 14th. Could you let me know what short-term repayment options are available? Please reply in writing.”
- **Confirmation** — “Demo request AG-014 received. Awaiting review. £25 is still due on the 14th.”

Use text and icons alongside colour. Make the purchase input keyboard-accessible, announce updated results to screen readers and keep motion optional. Group the next action, amount and date together on the dashboard.

## 90-second live demo

| Time | On screen | Speaker |
|---|---|---|
| 0–17s | Dashboard with £280 balance, £1,000 limit, £25 minimum due on the 14th | “Meet Alex. They get paid on the first, their card payment is due on the fourteenth, and when money gets tight, making a phone call feels like another task to put off. Here’s what their card app could do differently.” |
| 17–38s | Enter £50 in the purchase preview. | “Now Alex can see how much of their limit they’re using and what a purchase would change. This £50 spend would move them from 28% to 33%, above the 30% target they chose. Alex clears the preview. It was only a what-if.” |
| 38–82s | Review support request, confirm and display pending status. | “Alex thinks they may struggle to make the minimum payment. They open a short written request, check it, and send it. They get a reference and can follow the response in the app. The payment remains due while the request is reviewed.” |
| 82–90s | Close on dashboard and two actions. | “Adaptive Credit Guard makes it easier to understand a balance and ask for help before falling behind.” |

## Build plan for four people

Use one React app with shared fixture data and a reset button. Choose the stack the team already knows. Start with local mocks so the demo works without internet access.

| Owner | Files or deliverable | Done when |
|---|---|---|
| 1 · Interface | Dashboard, Gauge and PurchasePreview components | The dashboard and panels render the same account data, keyboard input works and every gauge state has a text label. |
| 2 · Logic | Account fixture, purchase functions, demo state | Preview never changes the actual balance or statement minimum. |
| 3 · Integrations | Mock support adapter and support review panel | Draft → review → submitted works and shows a simulated case reference. A failed send preserves the draft for retry. |
| 4 · Pitch and QA | Six-slide outline, speaker script, fallback screenshots and integration checks | One uninterrupted demo fits 90 seconds. The team can explain gauge thresholds and pending support status. |

**Agree on the contract first.** Represent money in integer pence. Keep card balance, credit limit, remaining statement minimum, due date and selected target in shared state. Keep the purchase preview separate. Model support results as draft, editing, review, submitting, submitted or failed. Guard against duplicate support confirmations. Assign one person to merge the root app wiring.

**Build order.** Lock the fixture and copy together. Build the UI and pure logic in parallel while the support flow and pitch take shape. Integrate early with a complete happy path, then test failed support submission. Record the final run and keep a few screenshots handy. If time runs short, use a static baseline screen, a simple gauge and a fixed editable support template. Cut animation and live integrations first.

**Production questions for later.** A template is enough for the prototype. If you add an LLM, use synthetic data, constrain it to drafting from user-confirmed facts, and keep the editable template as a fallback. Lender decisions belong in deterministic or lender-controlled workflows.

## Slide outline

1. **Making credit accessible** — Lead with Alex’s story and the three barriers.
2. **One dashboard, two actions** — Understand the balance and ask for support.
3. **Live demo** — Use the script above.
4. **What happens when money is tight** — Show the support request and pending review state.
5. **Why Capital One** — Connect the proposal to customer understanding and support. Show what a pilot would measure.
6. **Close** — “Make the next step clear, especially when money is tight.”

## Questions judges might ask

- **Do you store people's financial data?** No. Accounts only hold a username, a securely hashed password and a login session. Balances, purchases and statements stay on the user's device, separately for each account.

- **Does 30% change someone’s score?** The prototype uses a sample customer target. It predicts the share of this card’s limit in use after a purchase. Credit scoring and reporting depend on the model and reported data. The proposed UK pitch drops the FICO weighting statistic.
- **Does a support request buy 14 extra days?** It opens a case for lender review. The prototype shows receipt, remaining amount due, and a written reply preference.
- **Why use AI?** It’s optional for drafting a message. An editable template covers the core need and works offline for the demo.
- **How would you know it helps?** First test whether participants can explain what they owe and when, preview a purchase, and complete a written support request. A pilot could compare on-time minimum payments, completed requests and time to lender response against the standard experience. Include participants with the access needs the design aims to serve.

## Sources for the pitch

- [FCA Consumer Duty, PRIN 2A](https://handbook.fca.org.uk/handbook/prin2a) — Consumer understanding and support outcomes inform the concept.
- [FCA Policy Statement PS24/2](https://www.fca.org.uk/publication/policy/ps24-2.pdf) — Rules on supporting borrowers in or approaching financial difficulty inform the proposed lender review workflow. The prototype demonstrates a request channel.
- [FICO on credit utilisation](https://www.myfico.com/credit-education/blog/accounts-credit-utilization-ratio) — The 30% point is not a universal scoring cutoff.
