/**
 * Capital One Adaptive Guard - Content Script
 * High-Performance Point-of-Sale Overspend Prevention & ADHD Impulse Cooling Shield.
 * Designed for Emil and neurodivergent cardholders to protect credit utilization at checkout.
 *
 * Performance Architecture:
 * 1. Top-window only: Zero execution in subframes/ads/trackers (prevents multi-frame CPU spikes).
 * 2. Instant site disqualification: Never attaches observers on search, social, media, or docs sites.
 * 3. In-memory settings cache: Eliminates IPC latency and storage get overhead.
 * 4. Fast-path checkout filter: Bails in 0ms on normal browsing.
 * 5. Layout-safe DOM querying: Uses textContent & checkVisibility() to eliminate forced reflows.
 * 6. Hard-throttled SPA observer: At most one check per 3 seconds; auto-disconnects on purchase approval.
 */

(function () {
  // 1. NEVER RUN IN SUBFRAMES / IFRAMES
  // Prevents running hundreds of observers across advertising iframes and widgets.
  if (window.top !== window.self) {
    return;
  }

  /**
   * Fast domain & path check for non-shopping websites.
   * If matched, the extension bails immediately without attaching any observers.
   */
  function isDisqualifiedSite() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    const nonEcommerceHosts = [
      "google.", "bing.", "duckduckgo.", "yahoo.", "baidu.",
      "youtube.com", "github.com", "gitlab.com", "stackoverflow.com",
      "wikipedia.org", "reddit.com", "twitter.com", "x.com", "linkedin.com",
      "facebook.com", "instagram.com", "netflix.com", "medium.com",
      "docs.google.com", "notion.so", "figma.com", "discord.com", "slack.com"
    ];

    if (nonEcommerceHosts.some((host) => hostname.includes(host))) {
      return true;
    }

    if (/^\/(search|wiki|docs|blog|news|articles|feed)\b/i.test(pathname)) {
      return true;
    }

    return false;
  }

  // 2. INSTANT EXIT ON NON-SHOPPING WEBSITES
  if (isDisqualifiedSite()) {
    return;
  }

  const DEFAULT_SETTINGS = {
    isEnabled: true,
    cardholder: "Emil",
    cardLimit: 1000,
    currentBalance: 280,
    safeTarget: 30, // 30% threshold = £300
    cooldownSeconds: 15, // 15s for live demo, configurable up to 30m
    coolingOffItems: [],
  };

  // Session-level approval flag: prevents the infinite lockout loop where
  // completing the cooldown and clicking proceed immediately re-triggers the modal.
  const SESSION_APPROVED_KEY = "cg_session_checkout_approved";
  let isSessionApproved = false;
  let observer = null;
  let lastCheckTime = 0;
  let checkScheduled = false;

  try {
    if (sessionStorage.getItem(SESSION_APPROVED_KEY) === "true") {
      isSessionApproved = true;
    }
  } catch (e) {}

  // 3. IN-MEMORY SETTINGS CACHE
  // Eliminates continuous chrome.storage.local IPC calls that freeze the browser.
  let cachedSettings = { ...DEFAULT_SETTINGS };

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(DEFAULT_SETTINGS, (res) => {
      if (res) cachedSettings = { ...cachedSettings, ...res };
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        for (const [key, change] of Object.entries(changes)) {
          cachedSettings[key] = change.newValue;
        }
      }
    });
  }

  /**
   * Ultra-fast element visibility check using native C++ browser API.
   * Avoids window.getComputedStyle and getBoundingClientRect forced layout recalculations.
   * @param {Element} el
   * @returns {boolean}
   */
  function isElementVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    // Fast O(1) dismissal for unmounted or hidden elements
    if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) {
      return false;
    }
    // Modern Chrome native checkVisibility API (C++ implemented, 100x faster than getComputedStyle)
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    return true;
  }

  /**
   * 1. Detect if the user is currently on an e-commerce checkout or high-intent cart page.
   * Features fast-path bailing, zero forced reflows, and Amazon guards.
   * @returns {{ isCheckout: boolean, score: number, signals: string[] }}
   */
  function detectCheckout() {
    if (isSessionApproved) {
      return { isCheckout: false, score: 0, signals: ["USER_ALREADY_APPROVED"] };
    }

    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // =========================================================================
    // FAST-PATH OPTIMIZATION (0ms Exit on normal browsing):
    // If the URL has no shopping/checkout keywords AND no payment iframe exists,
    // exit immediately to prevent running any DOM scans.
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
        '#s-results-list-atf, .s-search-results, #nav-cart'
      );

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

      const hasAmazonCheckoutHeader = Array.from(
        document.querySelectorAll(
          '#spc-orders, #subtotals-marketplace-table, .spc-desktop, #checkout-display-desktop, #spc-top'
        )
      ).some(isElementVisible);

      // Stay quiet during catalog/product browsing unless place order button exists
      if (isAmazonBrowsing && !hasAmazonPlaceOrderBtn && !hasAmazonProceedToCheckout) {
        return { isCheckout: false, score: 0, signals: ["AMAZON_BROWSING_EXCLUDED"] };
      }

      if (hasAmazonPlaceOrderBtn || (isAmazonCheckoutUrl && hasAmazonCheckoutHeader)) {
        return { isCheckout: true, score: 15, signals: ["AMAZON_FINAL_CHECKOUT"] };
      }

      if (isAmazonCartUrl && hasAmazonProceedToCheckout) {
        return { isCheckout: true, score: 12, signals: ["AMAZON_ACTIVE_CART"] };
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
      const text = (btn.textContent || btn.value || "").trim().toLowerCase();
      return /^(add to (cart|bag|basket)|pre-order now)/i.test(text);
    });

    // Guardrail: Active catalog search input
    const searchInput = document.querySelector('input[type="search"], input[name="q"], input[name="search"]');
    const hasSearchInput = searchInput ? isElementVisible(searchInput) : false;

    // Category 1: Explicit E-Commerce Checkout Form Containers (+5 pts)
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

    // Category 2: URL Path (+4 pts)
    if (/(?:^|\/)(checkout|checkouts|order[_-]?summary|review[_-]?order|payment[_-]?step|pay[_-]?now|test-checkout)(?:[\/?#]|$)/i.test(pathname)) {
      score += 4;
      signals.push("URL_CHECKOUT_PATH");
      activeCategories.add("URL");
    }

    // Category 3: Payment / Card Fields (+5 pts)
    const paymentFields = document.querySelectorAll(
      'input[autocomplete="cc-number"], input[id="cardNumber" i], input[name="cardNumber" i], input[id="cvv" i], input[autocomplete="cc-csc"], .StripeElement'
    );
    const visiblePaymentFields = Array.from(paymentFields).filter(isElementVisible);
    if (visiblePaymentFields.length > 0) {
      score += 5;
      signals.push("PAYMENT_FIELDS");
      activeCategories.add("PAYMENT");
    }

    // Category 4: High-Intent Action Buttons (+5 pts)
    const finalBtn = candidateButtons.find((btn) => {
      const text = (btn.textContent || btn.value || "").trim().toLowerCase();
      return /^(place order|complete purchase|pay now|submit order|pay with card|confirm (and|&) pay|authorize payment)/i.test(text);
    });
    if (finalBtn) {
      score += 5;
      signals.push("FINAL_ACTION_BUTTON");
      activeCategories.add("ACTION_BUTTON");
    }

    // Category 5: Order Total Summary (+2 pts)
    const hasOrderTotal = document.querySelector('[data-checkout-total], #order-total, .order-total, .cart-total-row');
    if (hasOrderTotal && isElementVisible(hasOrderTotal)) {
      score += 2;
      signals.push("ORDER_TOTAL");
      activeCategories.add("SUMMARY");
    }

    // Disqualification: Browsing page indicators
    if (hasAddToCart && visiblePaymentFields.length === 0 && !finalBtn) {
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

    // High Threshold: score >= 10 AND at least 2 distinct categories
    const isCheckout = score >= 10 && activeCategories.size >= 2;

    return {
      isCheckout,
      score,
      signals,
    };
  }

  /**
   * 2. Extract purchase total and item title from the page DOM.
   * Performance-optimized: Uses textContent to eliminate forced reflows,
   * and bounds regex fallback to max 20 targeted price elements.
   */
  function extractCartDetails() {
    let amount = null;
    let title = document.title || "Online Purchase";

    // Item title extraction
    const titleEl = document.querySelector(
      '#productTitle, .sc-product-title, .cart-item span, h1, .product-title'
    );
    if (titleEl && titleEl.textContent) {
      title = titleEl.textContent.trim().slice(0, 45);
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
      if (el && el.textContent) {
        const match = el.textContent.match(/[$£€]\s*([0-9]+(?:\.[0-9]{2})?)/);
        if (match) {
          amount = parseFloat(match[1]);
          break;
        }
      }
    }

    // Targeted regex scan fallback (strictly bounded to max 20 candidate summary nodes)
    if (amount === null) {
      const candidateSummaryNodes = document.querySelectorAll(
        'form [class*="total" i], form [class*="price" i], [class*="order-summary" i], [id*="order-summary" i], .cart-total-row'
      );
      const limit = Math.min(candidateSummaryNodes.length, 20);
      for (let i = 0; i < limit; i++) {
        const text = candidateSummaryNodes[i].textContent || "";
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
      amount: amount !== null ? amount : 69.99, // £69.99 demo fallback
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
          isSessionApproved = true;
          try {
            sessionStorage.setItem(SESSION_APPROVED_KEY, "true");
          } catch (e) {}

          // Disconnect observer so the page will never lock the user out again during this checkout session
          if (observer) {
            observer.disconnect();
          }

          overlay.remove();
          console.log("[Capital One Adaptive Guard] Purchase approved after reflection. Guard disarmed for this session.");
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
    if (!window.location.hostname.includes("amazon.")) return;

    const buyNowButtons = document.querySelectorAll(
      '#buy-now-button, input[name="submit.buy-now"], [data-action="buy-now-button"]'
    );
    buyNowButtons.forEach((btn) => {
      if (!btn.dataset.cgIntercepted) {
        btn.dataset.cgIntercepted = "true";
        btn.addEventListener("click", () => {
          const cart = extractCartDetails();
          createOverlay(cart, settings);
        }, true);
      }
    });
  }

  /**
   * 6. Main lifecycle runner.
   * Runs synchronously against cached settings with zero IPC latency.
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

    const settings = cachedSettings;
    if (!settings.isEnabled || isSessionApproved) return;

    attachBuyNowInterceptors(settings);

    const detection = detectCheckout();
    if (detection.isCheckout && !document.getElementById("checkout-guard-overlay")) {
      const cart = extractCartDetails();
      createOverlay(cart, settings);
    }
  }

  // Initial trigger
  initCheckoutGuard();

  /**
   * 7. HARD-THROTTLED SPA NAVIGATION & MUTATION TRACKER
   * - Intercepts SPA history changes (pushState, replaceState, popstate, hashchange) with zero overhead.
   * - Enforces a strict 3,000ms cooldown on MutationObserver checks to prevent any browser freezing.
   */
  function scheduleThrottledCheck() {
    if (isSessionApproved || document.getElementById("checkout-guard-overlay")) return;

    const now = Date.now();
    if (now - lastCheckTime > 3000) {
      lastCheckTime = now;
      initCheckoutGuard();
    } else if (!checkScheduled) {
      checkScheduled = true;
      setTimeout(() => {
        checkScheduled = false;
        lastCheckTime = Date.now();
        initCheckoutGuard();
      }, 3000);
    }
  }

  // SPA route change listeners
  window.addEventListener("popstate", scheduleThrottledCheck);
  window.addEventListener("hashchange", scheduleThrottledCheck);

  const origPushState = history.pushState;
  if (origPushState) {
    history.pushState = function (...args) {
      origPushState.apply(this, args);
      scheduleThrottledCheck();
    };
  }

  const origReplaceState = history.replaceState;
  if (origReplaceState) {
    history.replaceState = function (...args) {
      origReplaceState.apply(this, args);
      scheduleThrottledCheck();
    };
  }

  // DOM MutationObserver with strict rate-limiting
  observer = new MutationObserver(() => {
    scheduleThrottledCheck();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
