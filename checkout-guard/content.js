/**
 * CheckoutGuard - Content Script
 * Detects checkout flows, extracts purchase totals, and injects reflection friction.
 */

(function () {
  let dismissedCheckout = null;
  const DEFAULT_SETTINGS = {
    isEnabled: true,
    monthlyBudget: 300,
    currentSpent: 120,
    cooldownSeconds: 15,
  };

  /**
   * Helper: Check if an element is genuinely rendered and visible on screen.
   * @param {Element} el
   * @returns {boolean}
   */
  function isElementVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Helper: Guardrails against common non-e-commerce websites and search engines.
   * @returns {boolean}
   */
  function isDisqualifiedSite() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    const nonEcommerceHosts = [
      "google.", "bing.", "duckduckgo.", "yahoo.", "baidu.",
      "youtube.com", "github.com", "gitlab.com", "stackoverflow.com",
      "wikipedia.org", "reddit.com", "twitter.com", "x.com", "linkedin.com",
      "facebook.com", "instagram.com", "netflix.com", "medium.com"
    ];
    if (nonEcommerceHosts.some((host) => hostname.includes(host))) {
      return true;
    }

    if (/^\/(search|wiki|docs|blog|news|articles|feed)\b/i.test(pathname)) {
      return true;
    }

    return false;
  }

  /**
   * 1. Detect if the user is currently on an e-commerce checkout page.
   * Features specialized Amazon guards, explicit platform container checks,
   * and a high multi-category threshold (score >= 10) to completely eliminate
   * false positives during normal catalog browsing.
   * @returns {{ isCheckout: boolean, score: number, signals: string[] }}
   */
  function detectCheckout() {
    if (isDisqualifiedSite()) {
      return { isCheckout: false, score: 0, signals: ["DISQUALIFIED_DOMAIN"] };
    }

    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // =========================================================================
    // SPECIALIZED AMAZON HANDLING
    // Normal Amazon browsing includes search bars, product buy boxes, and nav carts.
    // We only trigger when the user has actually entered the final checkout funnel.
    // =========================================================================
    if (hostname.includes("amazon.")) {
      // 1. Browsing indicators on Amazon
      const isAmazonBrowsing = !!document.querySelector(
        '#add-to-cart-button, #buy-now-button, #twotabsearchtextbox, #nav-search-bar-form, ' +
        '#s-results-list-atf, .s-search-results, #sc-active-cart, #nav-cart'
      );

      // 2. Strict Amazon Checkout indicators
      const isAmazonCheckoutUrl = /\/(gp\/buy|checkout\/spc|buy\/spc|buy\/payselect|gp\/checkout)\//i.test(pathname);
      const hasAmazonPlaceOrderBtn = Array.from(
        document.querySelectorAll(
          '#placeYourOrder, input[name="placeYourOrder1"], input[name*="placeYourOrder"], ' +
          '#bottomSubmitOrderButtonId, [data-action="place-your-order"]'
        )
      ).some(isElementVisible);
      const hasAmazonCheckoutHeader = Array.from(
        document.querySelectorAll(
          '#spc-orders, #subtotals-marketplace-table, .spc-desktop, #checkout-display-desktop, #spc-top'
        )
      ).some(isElementVisible);

      // If browsing elements are present and the place order button is NOT present, stay quiet!
      if (isAmazonBrowsing && !hasAmazonPlaceOrderBtn) {
        return { isCheckout: false, score: 0, signals: ["AMAZON_BROWSING_EXCLUDED"] };
      }

      // Only fire if inside the true Amazon purchase funnel
      if (hasAmazonPlaceOrderBtn || (isAmazonCheckoutUrl && hasAmazonCheckoutHeader)) {
        return {
          isCheckout: true,
          score: 15,
          signals: ["AMAZON_CONFIRMED_CHECKOUT"],
        };
      }

      return { isCheckout: false, score: 0, signals: ["AMAZON_NON_CHECKOUT"] };
    }

    // =========================================================================
    // GENERAL E-COMMERCE DETECTION (High Threshold: Score >= 10, Multi-category)
    // =========================================================================
    let score = 0;
    const signals = [];
    const activeCategories = new Set();

    const buttons = Array.from(
      document.querySelectorAll("button, input[type='submit'], a.button, [role='button']")
    ).filter(isElementVisible);

    // Guardrail: Product page with "Add to Cart" or "Add to Bag"
    const hasAddToCart = buttons.some((btn) => {
      const text = (btn.innerText || btn.value || "").trim().toLowerCase();
      return /^(add to (cart|bag|basket)|pre-order now)/i.test(text);
    });

    // Guardrail: Generic site-wide search box
    const hasSearchInput = Array.from(
      document.querySelectorAll('input[type="search"], input[name="q"], input[name="search"]')
    ).some(isElementVisible);

    // Category 1: Explicit E-Commerce Checkout Form / Step Containers (+5 pts)
    const checkoutContainers = [
      'form.woocommerce-checkout',
      'form#checkout-form',
      'form[data-elements-form]',
      '.step[data-step]',
      '[data-checkout-step]',
      '#checkout-step-payment',
      '.opc-wrapper-opc',
      '#payment-form'
    ];
    const hasCheckoutContainer = Array.from(
      document.querySelectorAll(checkoutContainers.join(", "))
    ).some(isElementVisible);

    if (hasCheckoutContainer) {
      score += 5;
      signals.push("CHECKOUT_CONTAINER_FOUND");
      activeCategories.add("CONTAINER");
    }

    // Category 2: Strict Checkout Route in URL (+4 pts)
    // Matches explicit checkout route segments, e.g. /checkout, /checkouts/123, /pay-now
    const isCheckoutPath = /(?:^|\/)(checkout|checkouts|order[_-]?summary|review[_-]?order|payment[_-]?step|pay[_-]?now|test-checkout)(?:[\/?#]|$)/i.test(pathname);
    if (isCheckoutPath) {
      score += 4;
      signals.push("STRICT_URL_CHECKOUT_PATH");
      activeCategories.add("URL");
    }

    // Category 3: Visible Payment & Credit Card Fields (+5 pts)
    const strictPaymentSelectors = [
      'input[autocomplete="cc-number"]',
      'input[autocomplete="cc-exp"]',
      'input[autocomplete="cc-csc"]',
      'input[id="card-number" i]',
      'input[id="cardNumber" i]',
      'input[name="card-number" i]',
      'input[name="cardNumber" i]',
      'input[name="cardnumber" i]',
      'input[id="cc-number" i]',
      'input[id="cvv" i]',
      'input[name="cvv" i]',
      'input[id="cvc" i]',
      'input[name="cvc" i]',
      '.StripeElement',
      'iframe[src*="js.stripe.com/v3/elements"]',
      'iframe[src*="paypal.com/smart/buttons"]'
    ];
    const visiblePaymentFields = Array.from(
      document.querySelectorAll(strictPaymentSelectors.join(", "))
    ).filter(isElementVisible);

    if (visiblePaymentFields.length > 0) {
      score += 5;
      signals.push(`PAYMENT_FIELDS(${visiblePaymentFields.length})`);
      activeCategories.add("PAYMENT");
    }

    // Category 4: High-Intent Final Order Action Buttons (+5 pts)
    const finalCheckoutBtn = buttons.find((btn) => {
      const text = (btn.innerText || btn.value || "").trim().toLowerCase();
      return /^(place order|complete purchase|pay now|submit order|pay with card|confirm (and|&) pay|authorize payment)/i.test(text);
    });
    if (finalCheckoutBtn) {
      score += 5;
      signals.push("FINAL_ACTION_BUTTON");
      activeCategories.add("ACTION_BUTTON");
    }

    // Category 5: Order Breakdown with Total (+2 pts)
    const hasOrderTotal = Array.from(
      document.querySelectorAll(
        '[data-checkout-total], #order-total, .order-total, .checkout-total, [data-test="total-amount"]'
      )
    ).some(isElementVisible);
    if (hasOrderTotal) {
      score += 2;
      signals.push("ORDER_TOTAL_BREAKDOWN");
      activeCategories.add("SUMMARY");
    }

    // Disqualification: Browsing page indicators
    if (hasAddToCart && visiblePaymentFields.length === 0 && !finalCheckoutBtn) {
      return {
        isCheckout: false,
        score,
        signals: [...signals, "DISQUALIFIED_PRODUCT_PAGE"],
      };
    }
    if (hasSearchInput && activeCategories.size < 2) {
      return {
        isCheckout: false,
        score,
        signals: [...signals, "DISQUALIFIED_CATALOG_BROWSING"],
      };
    }

    // HIGH THRESHOLD:
    // Requires total score >= 10 AND at least 2 distinct strong confirmation categories
    const isCheckout = score >= 10 && activeCategories.size >= 2;

    return {
      isCheckout,
      score,
      signals,
    };
  }

  /**
   * 2. Extract purchase total from the page DOM using standard selectors & regex.
   * @returns {number | null}
   */
  function extractCartTotal() {
    // Specific standard selectors & platform-specific total elements (including Amazon)
    const totalSelectors = [
      '[data-checkout-total]',
      '#order-total',
      '.order-total',
      '.cart-total',
      '.checkout-total',
      '[data-test="total-amount"]',
      '#subtotals-marketplace-table .grand-total-price',
      '.spc-order-summary .a-color-price',
      'td.grand-total-price',
      '#orderSummary .grand-total-price'
    ];

    for (const selector of totalSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText) {
        const match = el.innerText.match(/[$£€]\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d.,])/);
        if (match) return Number(match[1].replaceAll(',', ''));
      }
    }

    // General regex scan across summary or bold elements
    const elements = document.querySelectorAll('strong, b, span, p, td');
    for (const el of elements) {
      const text = el.innerText || "";
      if (/total/i.test(text) && /[$£€]/.test(text)) {
        const match = text.match(/[$£€]\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d.,])/);
        if (match) {
          const val = Number(match[1].replaceAll(',', ''));
          if (val > 0 && val < 50000) return val;
        }
      }
    }

    return null;
  }

  /**
   * 3. Check if the modal overlay is already mounted.
   * @returns {boolean}
   */
  function isAlreadyInjected() {
    return !!document.getElementById("checkout-guard-overlay");
  }

  /**
   * 4. Enforce the countdown friction timer before purchase can proceed.
   * @param {number} durationSeconds
   * @param {function} onComplete
   */
  function startCooldownTimer(durationSeconds, onComplete) {
    let remaining = durationSeconds;
    const timerDisplay = document.getElementById("cg-timer-seconds");

    if (!timerDisplay) return;

    timerDisplay.textContent = `${remaining}s`;

    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        timerDisplay.textContent = `${remaining}s`;
      } else {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);
  }

  /**
   * 5. Construct and mount the behavioral friction modal.
   * @param {number | null} cartTotal
   * @param {object} settings
   */
  function createOverlay(cartTotal, settings) {
    if (isAlreadyInjected()) return;

    const overlay = document.createElement("div");
    overlay.id = "checkout-guard-overlay";

    const savedBudget = Number(settings.monthlyBudget);
    const savedSpent = Number(settings.currentSpent);
    const budget = Number.isFinite(savedBudget) && savedBudget >= 0.01
      ? savedBudget : DEFAULT_SETTINGS.monthlyBudget;
    const spent = Number.isFinite(savedSpent) && savedSpent >= 0
      ? savedSpent : DEFAULT_SETTINGS.currentSpent;
    const purchaseAmount = cartTotal !== null ? cartTotal : 35.00; // sensible fallback
    const projectedSpent = (Math.round(spent * 100) + Math.round(purchaseAmount * 100)) / 100;
    const remainingBudget = Math.max(0, budget - projectedSpent);
    const percentUsed = (projectedSpent / budget) * 100;
    const percentLabel = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(percentUsed);

    let gaugeClass = "";
    const configuredCooldown = Number(settings.cooldownSeconds);
    const cooldownDuration = Number.isInteger(configuredCooldown) && configuredCooldown > 0
      ? configuredCooldown : DEFAULT_SETTINGS.cooldownSeconds;
    let statusText = "Within your budget";
    if (percentUsed >= 80 && percentUsed <= 100) {
      gaugeClass = "warning";
      statusText = "Approaching spending limit";
    } else if (percentUsed > 100) {
      gaugeClass = "danger";
      statusText = "Exceeds monthly target!";
    }

    overlay.innerHTML = `
      <div id="checkout-guard-modal" role="dialog" aria-modal="true" aria-labelledby="cg-modal-title">
        <div class="cg-badge">
          <span>🛑</span>
          <span>Impulse Shield Active</span>
        </div>
        
        <h2 id="cg-modal-title" class="cg-title">Take a Breath Before You Buy</h2>
        <p class="cg-subtitle">Checkout detected. Here is how this purchase changes your balance:</p>

        <div class="cg-impact-card">
          <div class="cg-impact-row">
            <span>Detected Order:</span>
            <strong id="cg-order-amount"></strong>
          </div>
          <div class="cg-impact-row">
            <span>Current Spent:</span>
            <span id="cg-current-spent"></span>
          </div>
          <div class="cg-impact-row">
            <span>Remaining after purchase:</span>
            <strong id="cg-remaining"></strong>
          </div>
          
          <div class="cg-gauge-bar">
            <div class="cg-gauge-fill"></div>
          </div>
          <div id="cg-budget-status" style="margin-top: 6px; font-size: 12px; color: #64748b; text-align: right;"></div>
        </div>

        <div class="cg-timer-box">
          <span>⏳ Cooldown pause:</span>
          <span id="cg-timer-seconds" class="cg-timer-seconds"></span>
        </div>

        <div class="cg-actions">
          <button id="cg-step-away" class="cg-btn-step-away">
            Step Away (Cancel Purchase)
          </button>
          <button id="cg-proceed" class="cg-btn-proceed" disabled>
            Proceed to Purchase
          </button>
        </div>
      </div>
    `;

    overlay.querySelector('#cg-order-amount').textContent = `£${purchaseAmount.toFixed(2)}`;
    overlay.querySelector('#cg-current-spent').textContent = `£${spent.toFixed(2)} of £${budget.toFixed(2)}`;
    overlay.querySelector('#cg-remaining').textContent = `£${remainingBudget.toFixed(2)}`;
    overlay.querySelector('.cg-gauge-bar').title = `${percentLabel}% of budget used`;
    const fill = overlay.querySelector('.cg-gauge-fill');
    if (gaugeClass) fill.classList.add(gaugeClass);
    fill.style.width = `${Math.min(100, percentUsed)}%`;
    overlay.querySelector('#cg-budget-status').textContent = `${statusText} (${percentLabel}%)`;
    overlay.querySelector('#cg-timer-seconds').textContent = `${cooldownDuration}s`;
    document.body.appendChild(overlay);

    // Event 1: Step Away (Close tab or redirect to safety)
    document.getElementById("cg-step-away").addEventListener("click", () => {
      // In web extension, we can redirect back or close
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "about:blank";
      }
    });

    // Event 2: Start cooldown countdown to unlock proceed button
    startCooldownTimer(cooldownDuration, () => {
      const proceedBtn = document.getElementById("cg-proceed");
      const timerBox = document.querySelector(".cg-timer-box");
      if (proceedBtn) {
        proceedBtn.disabled = false;
        proceedBtn.classList.add("unlocked");
        proceedBtn.textContent = "I've considered it — Continue to Checkout";
        proceedBtn.addEventListener("click", () => {
          dismissedCheckout = `${window.location.href}|${cartTotal}`;
          overlay.remove();
        });
      }
      if (timerBox) {
        timerBox.style.background = "#f0fdf4";
        timerBox.style.borderColor = "#bbf7d0";
        timerBox.style.color = "#166534";
        timerBox.innerHTML = `<span>✅ Cooldown period complete</span>`;
      }
    });
  }

  /**
   * 6. Initialize CheckoutGuard lifecycle.
   */
  function initCheckoutGuard() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return;
    }

    chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
      if (!settings.isEnabled) return;

      const detection = detectCheckout();
      console.log("[CheckoutGuard] Page Analysis:", detection);

      if (detection.isCheckout && !isAlreadyInjected()) {
        const total = extractCartTotal();
        if (dismissedCheckout === `${window.location.href}|${total}`) return;
        createOverlay(total, settings);
      }
    });
  }

  // Initial trigger
  initCheckoutGuard();

  // Handle SPA / dynamically loaded checkouts via MutationObserver
  let debounceTimeout = null;
  const observer = new MutationObserver(() => {
    if (isAlreadyInjected()) return;
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      initCheckoutGuard();
    }, 1500);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
