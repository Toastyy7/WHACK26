# Adaptive Credit Guard
*Capital One hackathon · Making Credit Accessible · UK concept · Rough draft*

## Submission summary

Adaptive Credit Guard is an opt-in mode for a credit card app. It shows what a purchase would do to your balance, helps you make small repayments when your cash buffer allows, and lets you ask for repayment support in writing. It’s designed around barriers some people with dyscalculia, ADHD or executive dysfunction, and phone anxiety encounter when managing credit. Anyone can turn it on without disclosing a diagnosis.

**Pitch hook:** Meet Alex. They get paid on the 1st, their credit card payment is due on the 14th, and when money gets tight they put off making a phone call. The app shows them a balance and a deadline. It could also show them what to do next.

**Why Capital One:** This is about making credit easier to manage after approval. A clearer purchase preview, a repayment routine and an accessible route to support could help customers act earlier. A pilot would test whether that translates into fewer missed minimum payments and more completed support requests.

## What we’re building

| Feature | Customer experience | Demo boundaries |
|---|---|---|
| Safe-Zone Gauge | Show the balance in pounds, the share of the limit used and a plain-language label. A purchase preview updates the projected balance and tells the customer when they cross their selected target. | Use a sample 30% target. Display “Within your target” below 30%, “Above your target” from 30% to under 50%, and “Using at least half your limit” from 50%. These are interface bands. No credit-score prediction. |
| Micro-Settlement | Opt in to a £10 weekly payment and set a cash buffer. See when a payment is scheduled, posted or skipped, and pause or cancel the plan. Keep the statement minimum and due date prominent. | Use a simulated bank balance and payment service. Run only when the available balance is fresh and the proposed payment leaves at least the chosen buffer. Display a skip reason for low, stale or unavailable balance data. |
| Silent Grace | Tap “Ask for payment support”, preview and edit a short message, then confirm. Get a reference and follow updates in writing. | Send to a simulated lender inbox. Show “Request received · awaiting review”. Keep the due date and amount visible until the lender confirms an arrangement. |

### Screen copy

- **Purchase preview** — “A £50 purchase would take your balance to £330 of £1,000 (33%). That’s £30 above your £300 target.” Keep the current balance visible beside the preview. Provide “Clear preview”.
- **Payment posted** — “Your £10 payment went through. £15 of your statement minimum is still due on the 14th.” The simulator counts only payments posted and eligible for the current statement minimum.
- **Payment skipped** — “We skipped this £10 payment because it would leave less than your £50 cash buffer. £15 is still due on the 14th.”
- **Support draft** — “I may struggle to make my payment due on the 14th. Could you let me know what short-term repayment options are available? Please reply in writing.”
- **Confirmation** — “Demo request AG-014 received. Awaiting review. £15 is still due on the 14th.”

Use text and icons alongside colour. Make the purchase input keyboard-accessible, announce updated results to screen readers and keep motion optional. In the comparison view, use a plausible standard dashboard with the same data. In Adaptive Mode, group the next action, amount and date together.

## 90-second live demo

| Time | On screen | Speaker |
|---|---|---|
| 0–17s | Standard view with £280 balance, £1,000 limit, £25 minimum due on the 14th | “Meet Alex. They get paid on the first, their card payment is due on the fourteenth, and when money gets tight, making a phone call feels like another task to put off. Here’s what their card app could do differently.” |
| 17–38s | Turn on Adaptive Mode. Enter £50 in the purchase preview. | “Now Alex can see how much of their limit they’re using and what a purchase would change. This £50 spend would move them from 28% to 33%, above the 30% target they chose. Alex clears the preview. It was only a what-if.” |
| 38–62s | Opt in to £10 weekly with a £50 buffer. Run a scheduled payment with £75 available, then simulate £55 available at the next check. | “Alex sets up a ten-pound weekly payment. The first one leaves £65 in their bank account, and the amount still due drops to £15. Next week, they have £55 available. Taking another £10 would leave £45, so we skip it and show what’s still due.” |
| 62–82s | Review support request, confirm and display pending status. | “Alex thinks they may struggle to pay the rest. They open a short written request, check it, and send it. They get a reference and can follow the response in the app. The payment remains due while the request is reviewed.” |
| 82–90s | Close on dashboard and three actions. | “Adaptive Credit Guard makes it easier to understand a balance, keep up with payments and ask for help before falling behind.” |

## Build plan for four people

Use one React app with shared fixture data and a reset button. Choose the stack the team already knows. Start with local mocks so the demo works without internet access.

| Owner | Files or deliverable | Done when |
|---|---|---|
| 1 · Interface | Dashboard, Gauge and PurchasePreview components | Both views render the same account data, keyboard input works and every gauge state has a text label. |
| 2 · Logic | Account fixture, repayment and purchase functions, demo state | Preview never changes the actual balance. £75 permits a £10 payment and £55 skips it. The first payment moves card balance to £270 and remaining minimum to £15. |
| 3 · Integrations | Mock banking and support adapters, support review panel | Missing or stale balances skip payments. Draft → review → submitted works and shows a simulated case reference. A failed send preserves the draft for retry. |
| 4 · Pitch and QA | Six-slide outline, speaker script, fallback screenshots and integration checks | One uninterrupted demo fits 90 seconds. The team can explain score thresholds, the cash buffer and pending support status. |

**Agree on the contract first.** Represent money in integer pence. Keep card balance, credit limit, remaining statement minimum, due date, available bank balance and its freshness, selected target, and cash buffer in shared state. Keep the purchase preview separate. Model payment results as posted, skipped or failed, and support results as draft, submitting, submitted or failed. Deduplicate each scheduled payment and each confirmed support request using a stable attempt ID. Assign one person to merge the root app wiring.

**Build order.** Lock the fixture and copy together. Build the UI and pure logic in parallel while the support flow and pitch take shape. Integrate early with a complete happy path, then test the skipped payment and failed submission. Record the final run and keep a few screenshots handy. If time runs short, use a static baseline screen, a simple gauge and a fixed editable support template. Cut animation and live integrations first.

**Production questions for later.** Open Banking balance access would need customer consent. Initiating a payment would require its own authorised mechanism. A balance check is a snapshot, so a real release would need to account for pending debits, delayed balances and coordination with existing repayment instructions. A template is enough for the prototype. If you add an LLM, use synthetic data, constrain it to drafting from user-confirmed facts, and keep the editable template as a fallback. Payment rules and lender decisions belong in deterministic or lender-controlled workflows.

## Slide outline

1. **Making credit accessible** — Lead with Alex’s story and the three barriers.
2. **One dashboard, three actions** — Understand the balance, make a payment, ask for support.
3. **Live demo** — Use the script above.
4. **What happens when money is tight** — Show the skipped payment and the pending support state side by side.
5. **Why Capital One** — Connect the proposal to customer understanding and support. Show what a pilot would measure.
6. **Close** — “Make the next step clear, especially when money is tight.”

## Questions judges might ask

- **Does 30% change someone’s score?** The prototype uses a sample customer target. It predicts the share of this card’s limit in use after a purchase. Credit scoring and reporting depend on the model and reported data. The proposed UK pitch drops the FICO weighting statistic.
- **Could this overdraw the customer?** The demo checks whether a payment would leave the customer-selected cash buffer and skips when balance data is missing or stale. Real deployment would still need to handle concurrent spending and delays.
- **Does a support request buy 14 extra days?** It opens a case for lender review. The prototype shows receipt, remaining amount due, and a written reply preference.
- **Why use AI?** It’s optional for drafting a message. An editable template covers the core need and works offline for the demo.
- **How would you know it helps?** First test whether participants can explain what they owe and when, preview a purchase, and complete a written support request. A pilot could compare on-time minimum payments, completed requests, time to lender response and unintended overdraft incidents against the standard experience. Include participants with the access needs the design aims to serve.

## Sources for the pitch

- [FCA Consumer Duty, PRIN 2A](https://handbook.fca.org.uk/handbook/prin2a) — Consumer understanding and support outcomes inform the concept.
- [FCA Policy Statement PS24/2](https://www.fca.org.uk/publication/policy/ps24-2.pdf) — Rules on supporting borrowers in or approaching financial difficulty inform the proposed lender review workflow. The prototype demonstrates a request channel.
- [FICO on credit utilisation](https://www.myfico.com/credit-education/blog/accounts-credit-utilization-ratio) — The 30% point is not a universal scoring cutoff.
