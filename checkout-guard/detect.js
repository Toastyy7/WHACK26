/* Checkout detection and GBP total extraction. Pure page reads: no storage, no UI. */
(() => {
  const guard = globalThis.CheckoutGuard;

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

    // Category 1: Explicit E-Commerce Checkout Form / Step Containers (+5 pts)
    const checkoutContainers = [
      'form.woocommerce-checkout',
      'form#checkout-form',
      'form[data-elements-form]',
      '.step[data-step]',
      '[data-checkout-step]',
      '#checkout-step-payment',
      '[data-testid="onepage-pay-button-cluster"]',
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
      'iframe[src*="paypal.com/smart/buttons"]',
      'iframe[src^="https://checkout.pci.shopifyinc.com/"]',
      'iframe[src^="https://checkout.shopifycs.com/"]',
      'iframe[name^="card-fields-"]'
    ];
    const visiblePaymentFields = Array.from(
      document.querySelectorAll(strictPaymentSelectors.join(", "))
    ).filter(isElementVisible);

    if (visiblePaymentFields.length > 0) {
      score += 5;
      signals.push(`PAYMENT_FIELDS(${visiblePaymentFields.length})`);
      activeCategories.add("PAYMENT");
    }

    // Without a route, checkout container or payment field, the remaining
    // action/summary signals can score at most 7. Avoid layout reads on every button.
    if (!hasCheckoutContainer && !isCheckoutPath && visiblePaymentFields.length === 0) {
      return { isCheckout: false, score, signals };
    }

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

    // Category 4: High-Intent Final Order Action Buttons (+5 pts)
    const finalCheckoutBtn = buttons.find((btn) => {
      if (btn.id === 'checkout-pay-button') return true;
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
      '#checkout-pay-button',
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
  globalThis.CheckoutGuardDetect = Object.freeze({ detectCheckout, extractCartTotal });
})();
