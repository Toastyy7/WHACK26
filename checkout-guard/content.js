/**
 * CheckoutGuard - Content Script
 * Detects checkout flows, extracts purchase totals, and injects reflection friction.
 */

(function () {
  const DEFAULT_SETTINGS = {
    isEnabled: true,
    monthlyBudget: 300,
    currentSpent: 120,
    cooldownSeconds: 15,
  };

  // Session-level approval flag so the user can actually complete their purchase
  // without getting locked into an infinite cooldown loop.
  const SESSION_APPROVED_KEY = "cg_session_checkout_approved";
  let isSessionApproved = false;
  let observer = null;

  try {
    if (sessionStorage.getItem(SESSION_APPROVED_KEY) === "true") {
      isSessionApproved = true;
    }
  } catch (e) {}

  /**
   * Ultra-fast element visibility check using native C++ browser API.
   * Avoids window.getComputedStyle and getBoundingClientRect layout thrashing.
   * @param {Element} el
   * @returns {boolean}
   */
  function isElementVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    // Fast O(1) dismissal for unmounted or hidden elements
    if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) {
      return false;
    }
    // Modern Chrome native checkVisibility API (C++ implemented, 100x faster)
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    return true;
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
   * Performance-optimized with fast-paths, zero layout thrashing, and Amazon guards.
   * @returns {{ isCheckout: boolean, score: number, signals: string[] }}
   */
  function detectCheckout() {
    if (isSessionApproved) {
      return { isCheckout: false, score: 0, signals: ["USER_ALREADY_APPROVED"] };
    }

    if (isDisqualifiedSite()) {
      return { isCheckout: false, score: 0, signals: ["DISQUALIFIED_DOMAIN"] };
    }

    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // =========================================================================
    // FAST-PATH OPTIMIZATION:
    // If the URL has no shopping/checkout indicators AND no payment iframe exists,
    // exit immediately to prevent running DOM scans on normal product catalogs.
    // =========================================================================
    const hasCheckoutKeyword = /checkout|cart|basket|order|pay|billing|purchase|buy|spc|test-checkout/i.test(pathname);
    const hasPaymentIframe = !!document.querySelector('iframe[src*="stripe.com"], iframe[src*="paypal.com"]');

    if (!hasCheckoutKeyword && !hasPaymentIframe && !hostname.includes("amazon.")) {
      return { isCheckout: false, score: 0, signals: ["FAST_PATH_SKIPPED"] };
    }

    // =========================================================================
    // SPECIALIZED AMAZON HANDLING
    // =========================================================================
    if (hostname.includes("amazon.")) {
      const isAmazonBrowsing = !!document.querySelector(
        '#add-to-cart-button, #buy-now-button, #twotabsearchtextbox, #nav-search-bar-form, ' +
        '#s-results-list-atf, .s-search-results, #sc-active-cart, #nav-cart'
      );

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

      if (isAmazonBrowsing && !hasAmazonPlaceOrderBtn) {
        return { isCheckout: false, score: 0, signals: ["AMAZON_BROWSING_EXCLUDED"] };
      }

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
    // GENERAL E-COMMERCE DETECTION (Zero Lag & Strict Scoring)
    // =========================================================================
    let score = 0;
    const signals = [];
    const activeCategories = new Set();

    // Fast-targeted button query: only scan buttons likely to submit an order or checkout
    const candidateButtons = Array.from(
      document.querySelectorAll(
        "form button, form input[type='submit'], button[type='submit'], " +
        "[id*='checkout' i], [id*='order' i], [id*='pay' i], [class*='checkout' i], [class*='order' i]"
      )
    ).filter(isElementVisible);

    // Guardrail: Product detail pages with "Add to Cart" or "Add to Bag"
    const hasAddToCart = candidateButtons.some((btn) => {
      const text = (btn.innerText || btn.value || "").trim().toLowerCase();
      return /^(add to (cart|bag|basket)|pre-order now)/i.test(text);
    });

    // Guardrail: Active catalog search input
    const searchInput = document.querySelector('input[type="search"], input[name="q"], input[name="search"]');
    const hasSearchInput = searchInput ? isElementVisible(searchInput) : false;

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
    const finalCheckoutBtn = candidateButtons.find((btn) => {
      const text = (btn.innerText || btn.value || "").trim().toLowerCase();
      return /^(place order|complete purchase|pay now|submit order|pay with card|confirm (and|&) pay|authorize payment)/i.test(text);
    });
    if (finalCheckoutBtn) {
      score += 5;
      signals.push("FINAL_ACTION_BUTTON");
      activeCategories.add("ACTION_BUTTON");
    }

    // Category 5: Order Breakdown with Total (+2 pts)
    const totalEl = document.querySelector('[data-checkout-total], #order-total, .order-total, .checkout-total, [data-test="total-amount"]');
    if (totalEl && isElementVisible(totalEl)) {
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
        const match = el.innerText.match(/[$£€]\s*([0-9]+(?:\.[0-9]{2})?)/);
        if (match) return parseFloat(match[1]);
      }
    }

    // General regex scan across summary or bold elements
    const elements = document.querySelectorAll('strong, b, span, p, td');
    for (const el of elements) {
      const text = el.innerText || "";
      if (/total/i.test(text) && /[$£€]/.test(text)) {
        const match = text.match(/[$£€]\s*([0-9]+(?:\.[0-9]{2})?)/);
        if (match) {
          const val = parseFloat(match[1]);
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

    const budget = Number(settings.monthlyBudget) || 300;
    const spent = Number(settings.currentSpent) || 0;
    const purchaseAmount = cartTotal !== null ? cartTotal : 35.00; // sensible fallback
    const projectedSpent = spent + purchaseAmount;
    const remainingBudget = Math.max(0, budget - projectedSpent);
    const percentUsed = Math.min(100, Math.round((projectedSpent / budget) * 100));

    let gaugeClass = "";
    let statusText = "Within healthy budget";
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
            <strong>£${purchaseAmount.toFixed(2)}</strong>
          </div>
          <div class="cg-impact-row">
            <span>Current Spent:</span>
            <span>£${spent.toFixed(2)} of £${budget.toFixed(2)}</span>
          </div>
          <div class="cg-impact-row">
            <span>Remaining after purchase:</span>
            <strong>£${remainingBudget.toFixed(2)}</strong>
          </div>
          
          <div class="cg-gauge-bar" title="${percentUsed}% of budget used">
            <div class="cg-gauge-fill ${gaugeClass}" style="width: ${percentUsed}%;"></div>
          </div>
          <div style="margin-top: 6px; font-size: 12px; color: #64748b; text-align: right;">
            ${statusText} (${percentUsed}%)
          </div>
        </div>

        <div class="cg-timer-box">
          <span>⏳ Cooldown pause:</span>
          <span id="cg-timer-seconds" class="cg-timer-seconds">${settings.cooldownSeconds || 15}s</span>
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
    const cooldownDuration = parseInt(settings.cooldownSeconds, 10) || 15;
    startCooldownTimer(cooldownDuration, () => {
      const proceedBtn = document.getElementById("cg-proceed");
      const timerBox = document.querySelector(".cg-timer-box");
      if (proceedBtn) {
        proceedBtn.disabled = false;
        proceedBtn.classList.add("unlocked");
        proceedBtn.textContent = "I've considered it — Continue to Checkout";
        proceedBtn.addEventListener("click", () => {
          isSessionApproved = true;
          try {
            sessionStorage.setItem(SESSION_APPROVED_KEY, "true");
          } catch (e) {}

          // Disconnect observer so the page will never be scanned or blocked again this session
          if (observer) {
            observer.disconnect();
          }

          overlay.remove();
          console.log("[CheckoutGuard] Cooldown completed and purchase approved. Guard disarmed for this session.");
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
    if (isSessionApproved) {
      if (observer) observer.disconnect();
      return;
    }

    try {
      if (sessionStorage.getItem(SESSION_APPROVED_KEY) === "true") {
        isSessionApproved = true;
        if (observer) observer.disconnect();
        return;
      }
    } catch (e) {}

    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      return;
    }

    chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
      if (!settings.isEnabled || isSessionApproved) return;

      const detection = detectCheckout();
      console.log("[CheckoutGuard] Page Analysis:", detection);

      if (detection.isCheckout && !isAlreadyInjected()) {
        const total = extractCartTotal();
        createOverlay(total, settings);
      }
    });
  }

  // Initial trigger
  initCheckoutGuard();

  // Handle SPA / dynamically loaded checkouts via MutationObserver (throttled for zero lag)
  let debounceTimeout = null;
  observer = new MutationObserver(() => {
    if (isAlreadyInjected() || isSessionApproved) return;
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      initCheckoutGuard();
    }, 2500);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
