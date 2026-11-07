/**
 * Capital One Adaptive Guard - Content Script
 * Point-of-Sale Overspend Prevention & ADHD Impulse Cooling Shield.
 * Designed for Emil and neurodivergent cardholders to protect credit utilization at checkout.
 */

(function () {
  const DEFAULT_SETTINGS = {
    isEnabled: true,
    cardholder: "Emil",
    cardLimit: 1000,
    currentBalance: 280,
    safeTarget: 30, // 30% threshold = £300
    cooldownSeconds: 15, // 15s for live demo, configurable up to 30m
    coolingOffItems: [],
  };

  /**
   * Helper: Check if an element is genuinely rendered and visible on screen.
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
   * Guardrails against common non-e-commerce websites and search engines.
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
   * 1. Detect if the user is currently on an e-commerce checkout or high-intent cart page.
   */
  function detectCheckout() {
    if (isDisqualifiedSite()) {
      return { isCheckout: false, score: 0, signals: ["DISQUALIFIED_DOMAIN"] };
    }

    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // =========================================================================
    // SPECIALIZED AMAZON HANDLING
    // =========================================================================
    if (hostname.includes("amazon.")) {
      const isAmazonCheckoutUrl = /\/(gp\/buy|checkout\/spc|buy\/spc|buy\/payselect|gp\/checkout)\//i.test(pathname);
      const isAmazonCartUrl = /\/(cart|gp\/cart|gp\/aw\/c)\b/i.test(pathname);
      
      const hasAmazonPlaceOrderBtn = Array.from(
        document.querySelectorAll(
          '#placeYourOrder, input[name="placeYourOrder1"], input[name*="placeYourOrder"], ' +
          '#bottomSubmitOrderButtonId, [data-action="place-your-order"]'
        )
      ).some(isElementVisible);

      const hasAmazonProceedToCheckout = Array.from(
        document.querySelectorAll(
          'input[name="proceedToRetailCheckout"], #sc-buy-box-ptc-button, [data-feature-id="proceed-to-checkout-action"]'
        )
      ).some(isElementVisible);

      if (hasAmazonPlaceOrderBtn || (isAmazonCheckoutUrl && document.querySelector('#subtotals-marketplace-table, .spc-desktop'))) {
        return { isCheckout: true, score: 15, signals: ["AMAZON_FINAL_CHECKOUT"] };
      }

      if (isAmazonCartUrl && hasAmazonProceedToCheckout) {
        return { isCheckout: true, score: 12, signals: ["AMAZON_ACTIVE_CART"] };
      }

      return { isCheckout: false, score: 0, signals: ["AMAZON_BROWSING"] };
    }

    // =========================================================================
    // GENERAL E-COMMERCE DETECTION (e.g. test-checkout.html, Shopify, WooCommerce)
    // =========================================================================
    let score = 0;
    const signals = [];
    const activeCategories = new Set();

    const buttons = Array.from(
      document.querySelectorAll("button, input[type='submit'], a.button, [role='button']")
    ).filter(isElementVisible);

    // Category 1: Explicit E-Commerce Checkout Form Containers
    const checkoutContainers = [
      'form.woocommerce-checkout',
      'form#checkout-form',
      'form[data-elements-form]',
      '.step[data-step]',
      '[data-checkout-step]',
      '#checkout-step-payment',
      '.opc-wrapper-opc',
      '#payment-form',
      '.checkout-container'
    ];
    if (document.querySelector(checkoutContainers.join(", "))) {
      score += 5;
      signals.push("CHECKOUT_CONTAINER");
      activeCategories.add("CONTAINER");
    }

    // Category 2: URL Path
    if (/(?:^|\/)(checkout|checkouts|order[_-]?summary|review[_-]?order|payment[_-]?step|pay[_-]?now|test-checkout)(?:[\/?#]|$)/i.test(pathname)) {
      score += 4;
      signals.push("URL_CHECKOUT_PATH");
      activeCategories.add("URL");
    }

    // Category 3: Payment / Card Fields
    const paymentFields = document.querySelectorAll(
      'input[autocomplete="cc-number"], input[id="cardNumber" i], input[name="cardNumber" i], input[id="cvv" i], input[autocomplete="cc-csc"], .StripeElement'
    );
    if (Array.from(paymentFields).some(isElementVisible)) {
      score += 5;
      signals.push("PAYMENT_FIELDS");
      activeCategories.add("PAYMENT");
    }

    // Category 4: High-Intent Action Buttons
    const finalBtn = buttons.find((btn) => {
      const text = (btn.innerText || btn.value || "").trim().toLowerCase();
      return /^(place order|complete purchase|pay now|submit order|pay with card|confirm (and|&) pay|authorize payment)/i.test(text);
    });
    if (finalBtn) {
      score += 5;
      signals.push("FINAL_ACTION_BUTTON");
      activeCategories.add("ACTION_BUTTON");
    }

    // Category 5: Order Total Summary
    const hasOrderTotal = document.querySelector('[data-checkout-total], #order-total, .order-total, .cart-total-row');
    if (hasOrderTotal && isElementVisible(hasOrderTotal)) {
      score += 3;
      signals.push("ORDER_TOTAL");
      activeCategories.add("SUMMARY");
    }

    const isCheckout = score >= 8 || activeCategories.size >= 2;

    return {
      isCheckout,
      score,
      signals,
    };
  }

  /**
   * 2. Extract purchase total and item title from the page DOM.
   */
  function extractCartDetails() {
    let amount = null;
    let title = document.title || "Online Purchase";

    // Item title extraction
    const titleEl = document.querySelector(
      '#productTitle, .sc-product-title, .cart-item span, h1, .product-title'
    );
    if (titleEl && titleEl.innerText) {
      title = titleEl.innerText.trim().slice(0, 45);
    }

    // Price selectors
    const totalSelectors = [
      '[data-checkout-total]',
      '#order-total',
      '.order-total',
      '.cart-total',
      '.checkout-total',
      '[data-test="total-amount"]',
      '#subtotals-marketplace-table .grand-total-price',
      '.spc-order-summary .a-color-price',
      '#sc-subtotal-amount-activecart .sc-price',
      'td.grand-total-price',
      '.cart-total-row span:last-child'
    ];

    for (const selector of totalSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText) {
        const match = el.innerText.match(/[$£€]\s*([0-9]+(?:\.[0-9]{2})?)/);
        if (match) {
          amount = parseFloat(match[1]);
          break;
        }
      }
    }

    // Fallback regex scan
    if (amount === null) {
      const elements = document.querySelectorAll('strong, b, span, p, td');
      for (const el of elements) {
        const text = el.innerText || "";
        if (/total/i.test(text) && /[$£€]/.test(text)) {
          const match = text.match(/[$£€]\s*([0-9]+(?:\.[0-9]{2})?)/);
          if (match) {
            const val = parseFloat(match[1]);
            if (val > 0 && val < 50000) {
              amount = val;
              break;
            }
          }
        }
      }
    }

    return {
      amount: amount !== null ? amount : 69.99, // default £69.99 demo fallback
      title,
    };
  }

  /**
   * 3. Enforce the countdown friction timer before purchase can proceed.
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
   * 4. Construct and mount the Capital One Adaptive Overspend Shield modal.
   */
  function createOverlay(cartDetails, settings) {
    if (document.getElementById("checkout-guard-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "checkout-guard-overlay";

    const cardLimit = Number(settings.cardLimit) || 1000;
    const currentBalance = Number(settings.currentBalance) || 280;
    const safeTargetPercent = Number(settings.safeTarget) || 30;
    const safeTargetPounds = (cardLimit * safeTargetPercent) / 100; // £300

    const purchaseAmount = cartDetails.amount;
    const projectedBalance = currentBalance + purchaseAmount;
    const projectedPercent = Math.round((projectedBalance / cardLimit) * 100);
    const currentPercent = Math.round((currentBalance / cardLimit) * 100);

    const isBreach = projectedBalance > safeTargetPounds;
    const breachAmount = Math.max(0, projectedBalance - safeTargetPounds);

    let gaugeClass = "safe";
    let statusBadgeText = "Within Safe-Zone";
    let statusExplanation = `Safe zone: Keep below ${safeTargetPercent}% (£${safeTargetPounds.toFixed(0)})`;

    if (projectedPercent >= 50) {
      gaugeClass = "danger";
      statusBadgeText = "High Utilization Risk (>50%)";
      statusExplanation = `Warning: Pushes your card to ${projectedPercent}% of limit!`;
    } else if (isBreach) {
      gaugeClass = "warning";
      statusBadgeText = "⚠️ Safe-Zone Warning";
      statusExplanation = `This purchase is £${breachAmount.toFixed(2)} above your ${safeTargetPercent}% (£${safeTargetPounds.toFixed(0)}) target.`;
    }

    overlay.innerHTML = `
      <div id="checkout-guard-modal" role="dialog" aria-modal="true" aria-labelledby="cg-modal-title">
        <div class="cg-brand-header">
          <span class="cg-brand-logo">◈</span>
          <span>CAPITAL ONE · ADAPTIVE GUARD</span>
        </div>

        <div class="cg-badge ${gaugeClass}">
          <span>${isBreach ? "⚠️" : "🛡️"}</span>
          <span>${statusBadgeText}</span>
        </div>
        
        <h2 id="cg-modal-title" class="cg-title">Take a Breath, ${settings.cardholder || "Emil"}</h2>
        <p class="cg-subtitle">Checkout detected at <strong>${window.location.hostname}</strong>.</p>

        <div class="cg-impact-card">
          <div class="cg-impact-row">
            <span>Item:</span>
            <strong title="${cartDetails.title}">${cartDetails.title}</strong>
          </div>
          <div class="cg-impact-row">
            <span>Cart Total:</span>
            <strong class="cg-highlight-amount">£${purchaseAmount.toFixed(2)}</strong>
          </div>
          <div class="cg-impact-row">
            <span>Current Card Balance:</span>
            <span>£${currentBalance.toFixed(2)} of £${cardLimit.toFixed(2)} (${currentPercent}%)</span>
          </div>
          <div class="cg-impact-row cg-divider">
            <span>Projected New Balance:</span>
            <strong class="${isBreach ? "cg-danger-text" : ""}">£${projectedBalance.toFixed(2)} (${projectedPercent}%)</strong>
          </div>
          
          <div class="cg-gauge-bar" title="${projectedPercent}% of limit used">
            <div class="cg-gauge-fill ${gaugeClass}" style="width: ${Math.min(100, projectedPercent)}%;"></div>
          </div>
          <div class="cg-status-note">
            ${statusExplanation}
          </div>
        </div>

        <div class="cg-timer-box">
          <span>⏳ Reflection Cooldown:</span>
          <span id="cg-timer-seconds" class="cg-timer-seconds">${settings.cooldownSeconds || 15}s</span>
        </div>

        <div class="cg-actions">
          <button id="cg-sleep-on-it" class="cg-btn-sleep">
            ⏳ Sleep On It (Revisit in 30 Mins)
          </button>
          <button id="cg-proceed" class="cg-btn-proceed" disabled>
            Proceed to Checkout
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Save detected cart to storage so the Web App can display live sync
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        lastDetectedCart: {
          title: cartDetails.title,
          amount: purchaseAmount,
          store: window.location.hostname,
          timestamp: Date.now(),
        }
      });
    }

    // ACTION 1: SLEEP ON IT (30-Minute ADHD Impulse Protection)
    document.getElementById("cg-sleep-on-it").addEventListener("click", () => {
      const newItem = {
        id: `cool-${Date.now()}`,
        title: cartDetails.title,
        price: purchaseAmount,
        url: window.location.href,
        store: window.location.hostname,
        savedAt: Date.now(),
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
      };

      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get({ coolingOffItems: [] }, (res) => {
          const updated = [newItem, ...(res.coolingOffItems || [])].slice(0, 10);
          chrome.storage.local.set({ coolingOffItems: updated });
        });
      }

      // Show positive reinforcement screen
      const modal = document.getElementById("checkout-guard-modal");
      modal.innerHTML = `
        <div class="cg-brand-header">
          <span class="cg-brand-logo">◈</span>
          <span>CAPITAL ONE · ADAPTIVE GUARD</span>
        </div>
        <div class="cg-badge safe" style="margin-top: 14px;">
          <span>✓</span>
          <span>Safe-Zone Protected!</span>
        </div>
        <h2 class="cg-title" style="margin-top: 12px;">Great decision, ${settings.cardholder || "Emil"}!</h2>
        <p class="cg-subtitle">
          We saved <strong>${cartDetails.title} (£${purchaseAmount.toFixed(2)})</strong> to your 30-minute cooling queue.
        </p>
        <div class="cg-impact-card" style="text-align: center;">
          <p style="font-size: 14px; color: #166534; font-weight: 600;">
            🎉 You just prevented your card from crossing the 30% safe threshold!
          </p>
          <p style="font-size: 13px; color: #64748b; margin-top: 6px;">
            Your balance remains safely at £${currentBalance.toFixed(2)} (28%).
          </p>
        </div>
        <div class="cg-actions">
          <button id="cg-close-success" class="cg-btn-sleep">
            Close & Step Away
          </button>
        </div>
      `;

      document.getElementById("cg-close-success").addEventListener("click", () => {
        overlay.remove();
        if (window.history.length > 1) {
          window.history.back();
        }
      });
    });

    // ACTION 2: COOLDOWN COUNTDOWN
    const cooldownDuration = parseInt(settings.cooldownSeconds, 10) || 15;
    startCooldownTimer(cooldownDuration, () => {
      const proceedBtn = document.getElementById("cg-proceed");
      const timerBox = document.querySelector(".cg-timer-box");
      if (proceedBtn) {
        proceedBtn.disabled = false;
        proceedBtn.classList.add("unlocked");
        proceedBtn.textContent = "I've Considered It — Continue Purchase";
        proceedBtn.addEventListener("click", () => {
          overlay.remove();
        });
      }
      if (timerBox) {
        timerBox.style.background = "#f0fdf4";
        timerBox.style.borderColor = "#bbf7d0";
        timerBox.style.color = "#166534";
        timerBox.innerHTML = `<span>✅ 15s reflection completed</span>`;
      }
    });
  }

  /**
   * 5. Intercept Amazon "Buy Now" button clicks before purchase completes.
   */
  function attachBuyNowInterceptors(settings) {
    const buyNowButtons = document.querySelectorAll(
      '#buy-now-button, input[name="submit.buy-now"], [data-action="buy-now-button"]'
    );
    buyNowButtons.forEach((btn) => {
      if (!btn.dataset.cgIntercepted) {
        btn.dataset.cgIntercepted = "true";
        btn.addEventListener("click", (e) => {
          const cart = extractCartDetails();
          createOverlay(cart, settings);
        }, true);
      }
    });
  }

  /**
   * 6. Main lifecycle runner.
   */
  function initCheckoutGuard() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      // Local testing mode without extension runtime
      const detection = detectCheckout();
      if (detection.isCheckout) {
        const cart = extractCartDetails();
        createOverlay(cart, DEFAULT_SETTINGS);
      }
      return;
    }

    chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
      if (!settings.isEnabled) return;

      attachBuyNowInterceptors(settings);

      const detection = detectCheckout();
      console.log("[Capital One Adaptive Guard] Detection:", detection);

      if (detection.isCheckout && !document.getElementById("checkout-guard-overlay")) {
        const cart = extractCartDetails();
        createOverlay(cart, settings);
      }
    });
  }

  // Initial trigger
  initCheckoutGuard();

  // Observer for dynamic SPAs
  let debounceTimeout = null;
  const observer = new MutationObserver(() => {
    if (document.getElementById("checkout-guard-overlay")) return;
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      initCheckoutGuard();
    }, 1200);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
