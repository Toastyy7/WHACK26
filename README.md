# Capital One Adaptive Guard · Overspend & Impulse Shield

*Warwick Hackathon · Making Credit Accessible Track · Capital One UK*

Adaptive Credit Guard is an accessibility and overspending protection layer designed for **Emil** and cardholders with **ADHD, Executive Dysfunction, Dyscalculia, and Phone Anxiety**.

It consists of two synchronized tools:
1. **The Web App Hub**: A calm, low-cognitive-load Capital One dashboard with visual Safe-Zone utilization gauges, a 30-minute ADHD impulse cooling queue, Smart Direct Debit payday anchors, and an assisted written support drafter with regulatory credit file warnings.
2. **The Point-of-Sale Chrome Extension (`checkout-guard/`)**: Actively monitors checkouts across the web (including real Amazon and offline e-commerce stores) to calculate real-time credit utilization before money is spent, offering an immediate 30-minute cooling-off window.

---

## 🚀 Quick Start (Running Both in 60 Seconds)

### 1. Load the Chrome Extension
1. Open Google Chrome (or Brave/Edge) and go to `chrome://extensions/`.
2. Toggle on **"Developer mode"** in the top-right corner.
3. Click **"Load unpacked"** and select the `/checkout-guard` folder in this repo.
4. Open `/checkout-guard/test-checkout.html` or any real shopping cart (like Amazon) to see the Capital One Impulse Shield intercept the checkout!

### 2. Run the Web Dashboard
```sh
# Option A: Run dev server
npm run dev

# Option B: Run the prebuilt static bundle offline
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
# Open http://127.0.0.1:4173
```

### 3. Run Automated Unit Tests
```sh
npm test
# All 5 test suites run via native Node test runner
```

---

## 🎤 90-Second Stage Demo Script (Featuring Emil)

| Time | Action | Speaker Script |
|---|---|---|
| **0–18s** | Introduce Emil & the Standard Dashboard (£280 balance / £1,000 limit) | *“Most teams invent a fictional persona. We didn’t have to. Meet Emil, sitting right here on our team. Emil lives with ADHD and dyscalculia. Online, one-click checkouts and abstract APR numbers make it terrifyingly easy to accidentally overspend and ruin his credit score.”* |
| **18–45s** | Switch to e-commerce tab (Amazon / `test-checkout.html`) with a £69.99 item | *“Emil is shopping online. When he reaches checkout, our Capital One Chrome Extension immediately intercepts: it calculates that £69.99 pushes his card from 28% to 35%, breaching his 30% Safe-Zone by £50. Instead of impulse-buying, Emil clicks ‘Sleep On It for 30 Minutes’.”* |
| **45–65s** | Switch back to Capital One Hub & show Cooling Queue | *“Back in Emil’s Capital One dashboard, the item is safely in his 30-minute Cooling Queue. When the dopamine cools down, Emil clicks ‘I don’t need this’—saving £69.99 and protecting his credit utilization score.”* |
| **65–85s** | Open Card 03: Assisted Support Drafter | *“When money is genuinely tight, traditional banks force you to make a terrifying phone call. Direct Debit doesn’t solve overspending. Emil uses our Guided Support Drafter: he answers 3 quick prompts, sees the mandatory SCOR credit file advisory, and submits an authentic personal letter under FCA Consumer Duty guidelines.”* |
| **85–90s** | Close on the 3 pillars | *“Capital One Adaptive Guard stops debt at the point of sale, cools down impulsive spending, and gives vulnerable customers a compliant voice in writing.”* |

---

## 🏆 Key Regulatory & Banking Alignments (For Judges)

* **FCA Consumer Duty (PRIN 2A)**: Proactively supports customers with characteristics of vulnerability and ensures clear comprehension of debt risks.
* **Overcoming the "Direct Debit Fallback"**: Direct Debit only cleans up after money has already been spent. Our Chrome Extension intervenes **at the point of sale** before the debt occurs.
* **SCOR Credit File Compliance**: Unlike naive "free money" buttons, our support drafter includes intentional friction and explicit advisories that formal forbearance can register an Arrangement to Pay marker on credit files.
