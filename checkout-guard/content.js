/**
 * CheckoutGuard - Content Script
 * Detects checkout flows, extracts purchase totals, and injects reflection friction.
 */

(function () {
  const guard = globalThis.CheckoutGuard;
  if (!guard?.available()) return;
  let settings;
  let dismissedCheckout = null;
  // shortcut: read once per page load, so an approval expiring while the page stays open is ignored.
  let approved = false;
  let active = null;
  // Display choices affect only our overlay, never the shopping page.
  let display = guard.displayPreferences();
  let fontFaceAdded = false;
  // Fonts load from the extension. A shop's strict font policy can block them; the popup then
  // keeps the normal font, which is the safe fallback.
  function useDisplay(next) {
    display = next;
    if (display.font === 'dyslexic' && !fontFaceAdded) {
      fontFaceAdded = true;
      const style = document.createElement('style');
      style.id = 'checkout-guard-font';
      style.textContent = [400, 700].map((weight) =>
        `@font-face{font-family:'OpenDyslexic';font-weight:${weight};font-display:swap;src:url("${guard.fileUrl(`fonts/opendyslexic-${weight}.woff2`)}") format("woff2")}`).join('');
      document.head.appendChild(style);
    }
    if (active) guard.applyDisplayPreferences(active.overlay, display);
  }
  let refreshTimer = null;
  let loadVersion = 0;

  const { detectCheckout, extractCartTotal } = globalThis.CheckoutGuardDetect;

  const signature = (total) => `${location.href}|${total}`;

  function createOverlay(total, checkoutSignature) {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = 'checkout-guard-overlay';
    guard.applyDisplayPreferences(overlay, display);
    overlay.innerHTML = `
      <section id="checkout-guard-modal" role="dialog" aria-modal="true" aria-labelledby="cg-modal-title" aria-describedby="cg-description" tabindex="-1">
        <button type="button" id="cg-close" aria-label="Close preview">×</button>
        <div class="cg-badge">🛡️ CheckoutGuard</div>
        <h2 id="cg-modal-title" class="cg-title">Take a breath before you buy</h2>
        <p id="cg-description" class="cg-subtitle">Here is what this order would leave you. Continuing adds it to what you owe on the dashboard (as planned, not a confirmed payment).</p>
        <p id="cg-balance-explanation" class="cg-detail"></p>
        <div class="cg-impact-card">
          <div class="cg-impact-row"><span id="cg-main-label">Safe to spend now:</span><strong id="cg-left-now"></strong></div>
          <div class="cg-impact-row"><span id="cg-order-label">This order:</span><strong id="cg-order-amount"></strong></div>
          <div id="cg-manual" hidden>
            <label for="cg-purchase-input">Purchase amount (£)</label>
            <input id="cg-purchase-input" inputmode="decimal" autocomplete="off" aria-describedby="cg-amount-note">
            <p id="cg-amount-note">We couldn't read a GBP order total. Enter it above to preview; other currencies need conversion to pounds.</p>
          </div>
          <div class="cg-impact-row"><span id="cg-after-label">After it:</span><strong id="cg-remaining"></strong></div>
          <div class="cg-gauge-bar" role="meter" aria-label="Safe limit used after this order" aria-valuemin="0" aria-valuemax="100"><div class="cg-gauge-fill"></div></div>
          <p id="cg-budget-status" role="status"></p>
          <p id="cg-current-spent" class="cg-detail"></p>
          <p id="cg-extra-detail" class="cg-detail" hidden></p>
          <p id="cg-safe-context" class="cg-detail" hidden></p>
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
    let savingPurchase = false;
    let spendRecorded = false;
    const purchaseId = crypto.randomUUID();
    const amountInput = find('#cg-purchase-input');
    find('#cg-manual').hidden = total !== null;

    function render() {
      const renderKey = JSON.stringify([settings.monthlyBudget, settings.currentSpent, manualAmount, amountInput.value, display.view, display.balanceFigure, settings.cardLimit]);
      if (renderKey === lastRender) return;
      lastRender = renderKey;
      const purchase = total ?? manualAmount;
      find('#cg-extra-detail').hidden = display.view !== 'detailed' || purchase === null;
      find('#cg-order-label').textContent = total === null ? 'Entered amount:' : 'This order:';
      find('#cg-order-amount').textContent = purchase === null ? 'Not available' : guard.money(purchase);
      const values = { safeLimit: guard.pence(settings.monthlyBudget), owed: guard.pence(settings.currentSpent), cardLimit: settings.cardLimit };
      const current = guard.getBalanceFigure(display.balanceFigure, values);
      const alternate = display.balanceFigure !== 'safe-to-spend';
      find('#cg-main-label').textContent = `${current.label} now:`;
      find('#cg-after-label').textContent = alternate ? `${current.label} after this order:` : 'After it:';
      find('#cg-left-now').textContent = current.amount === null ? 'Not available' : guard.money(current.amount);
      find('#cg-balance-explanation').textContent = current.amount === null ? 'Open the dashboard to sync your full card limit.' : current.description;
      find('#cg-safe-context').hidden = !alternate;
      const safeNow = `Safe to spend now: ${guard.money(guard.impact(settings, 0).remaining)}.`;
      find('#cg-safe-context').textContent = safeNow;

      // Same sentence as the dashboard's overview card.
      find('#cg-current-spent').textContent = `You owe ${guard.money(guard.pence(settings.currentSpent))} of your ${guard.money(guard.pence(settings.monthlyBudget))} safe limit.`;
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
        find('#cg-extra-detail').textContent = `${Math.round(result.percentage)}% of your safe limit used after this order.`;
        const over = result.projected - guard.pence(settings.monthlyBudget);
        const safeAfter = over > 0 ? `${guard.money(over)} over your safe limit` : `${guard.money(result.remaining)} safe to spend`;
        const after = guard.getBalanceFigure(display.balanceFigure, { ...values, owed: result.projected });
        find('#cg-remaining').textContent = alternate ? after.amount === null ? 'Not available' : guard.money(after.amount) : safeAfter;
        find('#cg-safe-context').textContent = `${safeNow} After this order: ${safeAfter}.`;
        fill.className = `cg-gauge-fill ${result.zone}`;
        fill.style.width = `${result.width}%`;
        meter.setAttribute('aria-valuenow', String(Math.round(result.width)));
        meter.setAttribute('aria-valuetext', result.label);
        // The row above already shows the amount; match the dashboard's badge words.
        find('#cg-budget-status').textContent = over > 0 ? 'Over your safe limit' : result.label;
      }
    }

    function close(dismiss = false, approveShop = false) {
      if (dismiss) dismissedCheckout = checkoutSignature;
      if (approveShop) {
        approved = true;
        guard.approve(location.hostname).catch((error) => console.warn('[CheckoutGuard] Could not remember approval:', error.message));
      }
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
        close(true, true);
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
    find('#cg-close').addEventListener('click', () => close(true, true));
    find('#cg-proceed').addEventListener('click', async () => {
      if (Date.now() < deadline || savingPurchase) return;
      const purchase = total ?? manualAmount;
      if (!Number.isSafeInteger(purchase) || purchase <= 0) {
        find('#cg-budget-status').textContent = 'Enter a GBP amount greater than £0 before continuing.';
        amountInput.focus();
        return;
      }
      savingPurchase = true;
      const button = find('#cg-proceed');
      button.disabled = true;
      button.textContent = 'Saving to dashboard…';
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      try {
        // Spend first: the dashboard's reply snapshot then already includes this purchase.
        if (!spendRecorded) await guard.recordSpend(purchase);
        spendRecorded = true;
        await guard.queuePurchase({ version: 1, id: purchaseId, amount: purchase,
          currency: 'GBP', merchant: location.hostname, date });
        if (overlay.isConnected) close(true, true);
      } catch (error) {
        find('#cg-budget-status').textContent = `Could not save the checkout: ${error.message} Try again.`;
        button.disabled = false;
        button.textContent = 'Retry and continue to checkout';
      } finally {
        savingPurchase = false;
      }
    });
    find('#cg-step-away').addEventListener('click', async () => {
      if (savingPurchase) return;
      const amount = total ?? manualAmount;
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        find('#cg-budget-status').textContent = 'Enter a GBP amount greater than £0 to save this checkout for later.';
        amountInput.focus();
        return;
      }
      savingPurchase = true;
      const button = find('#cg-step-away');
      button.disabled = true;
      button.textContent = 'Saving for later…';
      const savedAt = Date.now();
      try {
        await guard.queueCoolingItem({
          version: 1,
          id: purchaseId,
          title: (document.title.trim() || 'Online checkout').slice(0, 160),
          store: location.hostname.replace(/^www\./, '').slice(0, 100),
          amount,
          savedAt,
          expiresAt: savedAt + 30 * 60 * 1000,
        });
        close(true);
        if (window.history.length > 1) window.history.back();
        else window.location.assign('about:blank');
      } catch (error) {
        find('#cg-budget-status').textContent = `Could not save this checkout: ${error.message} Try again.`;
        button.disabled = false;
        button.textContent = 'Retry leaving checkout';
      } finally {
        savingPurchase = false;
      }
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
    if (settings.isEnabled && document.hidden && !active) return;
    if (!settings.isEnabled || approved || !detectCheckout().isCheckout) {
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
    if (document.hidden && !active) return;
    if (refreshTimer !== null) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refresh();
    }, 200);
  }

  async function loadSettings() {
    const version = ++loadVersion;
    try {
      const [loaded, shopApproved, savedDisplay] = await Promise.all([guard.load(), guard.isApproved(location.hostname), guard.getDisplayPreferences()]);
      if (version !== loadVersion) return;
      settings = loaded;
      useDisplay(savedDisplay);
      approved = approved || shopApproved;
      refresh();
    } catch (error) {
      // A failed storage read must not replace someone's saved budget with a guess.
      console.warn('[CheckoutGuard] Could not read settings:', error.message);
    }
  }

  const observer = new MutationObserver((records) => {
    if (document.hidden && !active) return;
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
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleRefresh();
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
  guard.subscribeDisplayPreferences(loadSettings);
  loadSettings();
})();
