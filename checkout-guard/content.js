/**
 * CheckoutGuard - Content Script
 * Detects checkout flows, extracts purchase totals, and injects reflection friction.
 */

(function () {
  const guard = globalThis.CheckoutGuard;
  if (!guard?.available()) return;
  let settings;
  let dismissedCheckout = null;
  let active = null;
  let refreshTimer = null;
  let loadVersion = 0;

  /**
   * Helper: Check if an element is genuinely rendered and visible on screen.
   * @param {Element} el
   * @returns {boolean}
   */
  function isElementVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    if (el.closest('#checkout-guard-overlay')) return false;
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
      "youtube.com", "github.com", "gitlab.com", "stackoverflow.com",
      "wikipedia.org", "reddit.com", "twitter.com", "x.com", "linkedin.com",
      "facebook.com", "instagram.com", "netflix.com", "medium.com"
    ];
    if (/^(?:www\.)?(?:google|bing|duckduckgo|yahoo|baidu)\.[a-z.]+$/.test(hostname) ||
        nonEcommerceHosts.some((host) => hostname === host || hostname.endsWith('.' + host))) {
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
    if (/(^|\.)amazon\.[a-z.]+$/.test(hostname)) {
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
    const selectors = [
      '[data-checkout-total]', '#order-total', '.order-total', '.checkout-total',
      '[data-test="total-amount"]', '#subtotals-marketplace-table .grand-total-price',
      'td.grand-total-price', '#orderSummary .grand-total-price',
    ];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (!isElementVisible(element)) continue;
        // An explicit total in a different currency must never fall back to a GBP item price.
        return guard.parseGbp(element.innerText);
      }
    }
    for (const element of document.querySelectorAll('strong, b, span, p, td')) {
      if (!isElementVisible(element)) continue;
      const text = element.innerText.trim();
      if (/^(?:grand\s+total|order\s+total|estimated\s+total|total(?:\s+due)?)[\s:]/i.test(text)) {
        const amount = guard.parseGbp(text);
        if (amount !== null) return amount;
      }
    }
    return null;
  }

  const signature = (total) => `${location.href}|${total}`;

  function createOverlay(total, checkoutSignature) {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = 'checkout-guard-overlay';
    overlay.innerHTML = `
      <section id="checkout-guard-modal" role="dialog" aria-modal="true" aria-labelledby="cg-modal-title" aria-describedby="cg-description" tabindex="-1">
        <button type="button" id="cg-close" aria-label="Close preview">×</button>
        <div class="cg-badge">🛡️ CheckoutGuard</div>
        <h2 id="cg-modal-title" class="cg-title">Take a breath before you buy</h2>
        <p id="cg-description" class="cg-subtitle">A quick look at how this order affects your monthly budget. This preview does not record a purchase.</p>
        <div class="cg-impact-card">
          <div class="cg-impact-row"><span id="cg-order-label">Detected order:</span><strong id="cg-order-amount"></strong></div>
          <div id="cg-manual" hidden>
            <label for="cg-purchase-input">Purchase amount (£)</label>
            <input id="cg-purchase-input" inputmode="decimal" autocomplete="off" aria-describedby="cg-amount-note">
            <p id="cg-amount-note">We couldn't read a GBP order total. Enter it above to preview; other currencies need conversion to pounds.</p>
          </div>
          <div class="cg-impact-row"><span>Already spent:</span><span id="cg-current-spent"></span></div>
          <div class="cg-impact-row"><span>Remaining after purchase:</span><strong id="cg-remaining"></strong></div>
          <div class="cg-gauge-bar" role="meter" aria-label="Projected monthly budget used" aria-valuemin="0" aria-valuemax="100"><div class="cg-gauge-fill"></div></div>
          <p id="cg-budget-status" role="status"></p>
        </div>
        <div class="cg-timer-box"><span id="cg-timer-label">Reflection pause:</span><span id="cg-timer-seconds" class="cg-timer-seconds" role="timer" aria-live="off"></span></div>
        <div id="cg-timer-status" role="status" class="cg-visually-hidden"></div>
        <div class="cg-actions">
          <button type="button" id="cg-step-away" class="cg-btn-step-away">Leave checkout</button>
          <button type="button" id="cg-proceed" class="cg-btn-proceed" disabled>Continue to checkout</button>
        </div>
        <p class="cg-footnote">Close or press Escape to dismiss this preview. Leaving does not cancel an order already placed.</p>
      </section>`;
    const find = (selector) => overlay.querySelector(selector);
    const modal = find('#checkout-guard-modal');
    const deadline = Date.now() + settings.cooldownSeconds * 1000;
    let interval;
    let manualAmount = null;
    let lastRender = '';
    const amountInput = find('#cg-purchase-input');
    find('#cg-manual').hidden = total !== null;

    function render() {
      const renderKey = JSON.stringify([settings.monthlyBudget, settings.currentSpent, manualAmount, amountInput.value]);
      if (renderKey === lastRender) return;
      lastRender = renderKey;
      const purchase = total ?? manualAmount;
      find('#cg-order-label').textContent = total === null ? 'Entered amount:' : 'Detected order:';
      find('#cg-order-amount').textContent = purchase === null ? 'Not available' : guard.money(purchase);
      find('#cg-current-spent').textContent = `${guard.money(guard.pence(settings.currentSpent))} of ${guard.money(guard.pence(settings.monthlyBudget))}`;
      const meter = find('.cg-gauge-bar');
      const fill = find('.cg-gauge-fill');
      if (purchase === null) {
        find('#cg-remaining').textContent = 'Not available';
        fill.style.width = '0%';
        fill.className = 'cg-gauge-fill';
        meter.setAttribute('aria-valuenow', '0');
        meter.setAttribute('aria-valuetext', 'Enter a GBP purchase amount to calculate the preview.');
        find('#cg-budget-status').textContent = amountInput.value
          ? 'Enter a non-negative amount with up to two decimal places.'
          : 'Enter a GBP total to see its impact.';
      } else {
        const result = guard.impact(settings, purchase);
        find('#cg-remaining').textContent = guard.money(result.remaining);
        fill.className = `cg-gauge-fill ${result.zone}`;
        fill.style.width = `${result.width}%`;
        meter.setAttribute('aria-valuenow', String(result.width));
        meter.setAttribute('aria-valuetext', `${guard.percent(result.percentage)} used. ${result.label}`);
        find('#cg-budget-status').textContent = `${result.label} (${guard.percent(result.percentage)} used)`;
      }
    }

    function close(dismiss = false) {
      if (dismiss) dismissedCheckout = checkoutSignature;
      clearInterval(interval);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus, true);
      overlay.remove();
      active = null;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    }

    function focusable() {
      return [...overlay.querySelectorAll('button:not(:disabled), input')].filter((el) => !el.closest('[hidden]'));
    }
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      } else if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) {
          event.preventDefault(); first.focus();
        }
      }
    }
    function onFocus(event) {
      if (!overlay.contains(event.target)) modal.focus();
    }

    function tick() {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      find('#cg-timer-seconds').textContent = remaining ? `${remaining}s` : 'Complete';
      if (!remaining) {
        clearInterval(interval);
        find('#cg-proceed').disabled = false;
        find('#cg-proceed').classList.add('unlocked');
        find('#cg-timer-status').textContent = 'Reflection pause complete. You can continue to checkout.';
      }
    }

    amountInput.addEventListener('input', () => {
      manualAmount = guard.pence(amountInput.value);
      amountInput.setAttribute('aria-invalid', String(amountInput.value !== '' && manualAmount === null));
      render();
    });
    find('#cg-close').addEventListener('click', () => close(true));
    find('#cg-proceed').addEventListener('click', () => {
      if (Date.now() >= deadline) close(true);
    });
    find('#cg-step-away').addEventListener('click', () => {
      close(true);
      if (window.history.length > 1) window.history.back();
      else window.location.assign('about:blank');
    });
    render();
    document.body.appendChild(overlay);
    active = { overlay, signature: checkoutSignature, render, close };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus, true);
    modal.focus();
    interval = setInterval(tick, 250);
    tick();
  }

  function refresh() {
    if (!settings) return;
    if (!settings.isEnabled || !detectCheckout().isCheckout) {
      active?.close();
      dismissedCheckout = null;
      return;
    }
    const total = extractCartTotal();
    const nextSignature = signature(total);
    if (active && active.signature !== nextSignature) active.close();
    if (active) active.render();
    else if (dismissedCheckout !== nextSignature) createOverlay(total, nextSignature);
  }

  function scheduleRefresh() {
    if (refreshTimer !== null) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refresh();
    }, 200);
  }

  async function loadSettings() {
    const version = ++loadVersion;
    try {
      const loaded = await guard.load();
      if (version !== loadVersion) return;
      settings = loaded;
      refresh();
    } catch (error) {
      // A failed storage read must not replace someone's saved budget with a guess.
      console.warn('[CheckoutGuard] Could not read settings:', error.message);
    }
  }

  const observer = new MutationObserver((records) => {
    if (active && !active.overlay.isConnected) {
      active.close();
      scheduleRefresh();
      return;
    }
    if (records.some((record) => {
      if (active?.overlay.contains(record.target)) return false;
      const nodes = [...record.addedNodes, ...record.removedNodes];
      if (nodes.length && nodes.every((node) => node.id === 'checkout-guard-overlay')) return false;
      return true;
    })) scheduleRefresh();
  });
  observer.observe(document.documentElement, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
  });
  document.addEventListener('input', (event) => {
    if (!active?.overlay.contains(event.target)) scheduleRefresh();
  });
  window.addEventListener('popstate', scheduleRefresh);
  window.addEventListener('hashchange', scheduleRefresh);
  // pushState/replaceState do not emit popstate. Watch the URL without modifying a site's history methods.
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      scheduleRefresh();
    }
  }, 750);
  window.addEventListener('pagehide', () => {
    active?.close();
    clearTimeout(refreshTimer);
    refreshTimer = null;
  });
  window.addEventListener('pageshow', scheduleRefresh);
  guard.subscribe(loadSettings);
  loadSettings();
})();
