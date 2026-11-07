"""Browser checks using real DOM/events and simulated Chrome storage.

pip install -r requirements-browser.txt
python -m playwright install chromium
npm run build && npm run test:browser

Set CHROMIUM_PATH to use an existing Chromium executable.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import shutil

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
MOCK_STORAGE = """
window.__storageListeners = new Set();
window.__notify = (oldData, newData) => {
  const changes = {};
  for (const key of new Set([...Object.keys(oldData), ...Object.keys(newData)])) {
    if (oldData[key] !== newData[key]) changes[key] = {oldValue: oldData[key], newValue: newData[key]};
  }
  for (const listener of window.__storageListeners) listener(changes, 'local');
};
window.__setSettings = (patch) => {
  const old = JSON.parse(localStorage.getItem('test-settings') || '{}');
  const next = {...old, ...patch};
  localStorage.setItem('test-settings', JSON.stringify(next));
  window.__notify(old, next);
};
window.addEventListener('storage', event => {
  if (event.key === 'test-settings') window.__notify(JSON.parse(event.oldValue || '{}'), JSON.parse(event.newValue || '{}'));
});
window.chrome = {...window.chrome, runtime: {}, storage: {
  onChanged: {
    addListener: listener => window.__storageListeners.add(listener),
    removeListener: listener => window.__storageListeners.delete(listener)
  },
  local: {
    get(defaults, done) {
      setTimeout(() => {
        if (window.__failRead) {
          chrome.runtime.lastError = {message: 'Simulated read failure'};
          done();
          delete chrome.runtime.lastError;
        } else done({...defaults, ...JSON.parse(localStorage.getItem('test-settings') || '{}')});
      }, 5);
    },
    set(data, done) {
      setTimeout(() => {
        if (window.__failWrite) {
          chrome.runtime.lastError = {message: 'Simulated save failure'};
          done();
          delete chrome.runtime.lastError;
        } else {
          window.__setSettings(data);
          done();
        }
      }, 5);
    }
  }
}};
"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
errors = []


def inject(page):
    for script in ('core.js', 'content.js'):
        page.add_script_tag(path=str(ROOT / 'checkout-guard' / script))
    page.add_style_tag(path=str(ROOT / 'checkout-guard/content.css'))


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'),
            headless=True, args=['--no-sandbox'],
        )
        context = browser.new_context(viewport={'width': 1440, 'height': 1100})
        context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
        page = context.new_page()
        page.goto(base + '/dist/')
        expect(page.get_by_label('Adaptive Mode')).to_be_checked()
        amount = page.get_by_label('What would a purchase cost (£)?')
        meter = page.get_by_role('meter')
        overview = page.get_by_role('region', name='Account overview')
        for purchase, percentage, zone in [('20', '30', 'warning'), ('50', '33', 'warning'), ('220', '50', 'danger'), ('800', '100', 'danger'), ('0', '28', 'safe')]:
            amount.fill(purchase)
            expect(meter).to_have_attribute('aria-valuenow', percentage)
            expect(meter).to_have_class('gauge ' + zone)
            expect(overview).to_contain_text('£280')
        amount.fill('800')
        expect(page.locator('#projection')).to_contain_text('Credit limit exceeded')
        for invalid in ['-1', '12.345', 'not money']:
            amount.fill(invalid)
            expect(amount).to_have_attribute('aria-invalid', 'true')
            expect(meter).to_have_attribute('aria-valuenow', '28')
        page.get_by_role('button', name='Clear preview').click()
        target = page.get_by_role('slider')
        target.focus()
        for _ in range(5): target.press('ArrowLeft')
        expect(target).to_have_value('25')
        expect(meter).to_have_class('gauge warning')
        page.get_by_role('button', name='Start weekly plan').click()
        page.get_by_role('button', name='Run scheduled check').click()
        expect(overview).to_contain_text('£270')
        expect(overview).to_contain_text('£15')
        expect(page.get_by_role('button', name='Run scheduled check')).to_be_disabled()
        page.get_by_role('button', name='Ask for payment support').click()
        message = page.get_by_label('Message to the lender')
        message.fill('Please reply in writing about my payment options.')
        page.get_by_role('button', name='Cancel', exact=True).click()
        page.get_by_role('button', name='Ask for payment support').click()
        expect(message).to_have_value('Please reply in writing about my payment options.')
        page.get_by_role('button', name='Review message').click()
        page.get_by_role('button', name='Confirm and send').click()
        expect(page.get_by_text('Request received · awaiting review')).to_be_visible()
        page.get_by_role('button', name='Reset demo', exact=True).click()
        expect(amount).to_have_value('')
        expect(meter).to_have_attribute('aria-valuenow', '28')
        page.set_viewport_size({'width': 375, 'height': 900})
        amount.fill('50')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        print('PASS dashboard: preview, target slider, payment, support draft/cancel/send, reset, mobile, nested offline path')

        extension = browser.new_context()
        extension.add_init_script(MOCK_STORAGE)
        extension.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
        checkout = extension.new_page()

        def boot(total='£69.99'):
            checkout.goto(base + '/checkout-guard/test-checkout.html')
            checkout.evaluate("localStorage.setItem('test-settings', JSON.stringify({cooldownSeconds: 1, isEnabled: true, monthlyBudget: 300, currentSpent: 120}))")
            checkout.locator('#order-total').evaluate('(el, text) => el.textContent = text', total)
            checkout.locator('#cardNumber').focus()
            inject(checkout)
            expect(checkout.get_by_role('dialog')).to_be_visible()

        for total in ['£1,234.56', '£69.99', '£0.00']:
            boot(total)
            expect(checkout.locator('#cg-order-amount')).to_have_text(total)
        expect(checkout.locator('#cg-proceed')).to_be_enabled(timeout=3000)
        checkout.locator('#cg-proceed').click()
        checkout.locator('#name').evaluate("el => el.insertAdjacentHTML('afterend', '<p>Address checked</p>')")
        checkout.wait_for_timeout(500)
        expect(checkout.locator('#checkout-guard-overlay')).to_have_count(0)
        checkout.locator('#order-total').evaluate("el => el.firstChild.data = '£80.00'")
        expect(checkout.locator('#cg-order-amount')).to_have_text('£80.00')
        checkout.locator('#order-total').evaluate("el => el.firstChild.data = '£100.00'")
        expect(checkout.locator('#cg-order-amount')).to_have_text('£100.00')
        checkout.evaluate('window.__setSettings({currentSpent: 250})')
        expect(checkout.locator('.cg-gauge-fill')).to_have_class('cg-gauge-fill danger')
        expect(checkout.locator('#cg-budget-status')).to_contain_text('£50.00 over')
        checkout.evaluate('window.__setSettings({isEnabled: false})')
        expect(checkout.locator('#checkout-guard-overlay')).to_have_count(0)
        checkout.evaluate('window.__setSettings({isEnabled: true})')
        expect(checkout.get_by_role('dialog')).to_be_visible()
        checkout.keyboard.press('Tab')
        expect(checkout.locator('#cg-close')).to_be_focused()
        checkout.keyboard.press('Shift+Tab')
        assert checkout.evaluate("document.getElementById('checkout-guard-overlay').contains(document.activeElement)")
        checkout.keyboard.press('Escape')
        expect(checkout.get_by_role('dialog')).to_have_count(0)
        expect(checkout.locator('#cardNumber')).to_be_focused()
        print('PASS checkout: grouped prices, changing totals, saved budget changes, on/off, Continue, focus trap, Escape and focus return')

        for total in ['€69.99', '$69.99', 'Calculating…']:
            boot(total)
            expect(checkout.locator('#cg-order-amount')).to_have_text('Not available')
            expect(checkout.locator('#cg-manual')).to_be_visible()
            checkout.locator('#cg-purchase-input').fill('-1')
            expect(checkout.locator('#cg-purchase-input')).to_have_attribute('aria-invalid', 'true')
            checkout.locator('#cg-purchase-input').fill('50')
            expect(checkout.locator('#cg-remaining')).to_have_text('£130.00')
            expect(checkout.locator('#cg-order-amount')).to_have_text('£50.00')
        # Removing checkout signals must close the dialog on SPA navigation.
        checkout.evaluate("document.querySelectorAll('input[autocomplete^=\"cc-\"], #submitOrderBtn, #order-total').forEach(el => el.remove()); history.pushState({}, '', '/products')")
        expect(checkout.locator('#checkout-guard-overlay')).to_have_count(0)
        print('PASS unknown/foreign totals: no guessed amount, manual GBP preview, invalid input, SPA exit')

        detection = extension.new_page()
        fixture = (ROOT / 'checkout-guard/test-checkout.html').read_text()
        detection.route('https://shop.mybox.com/**', lambda route: route.fulfill(body=fixture, content_type='text/html'))
        detection.goto('https://shop.mybox.com/checkout')
        inject(detection)
        expect(detection.get_by_role('dialog')).to_be_visible()
        detection.route('https://www.amazon.co.uk/**', lambda route: route.fulfill(body=fixture.replace('<body>', '<body><div id="nav-cart">Cart</div><div id="spc-top">Checkout</div>'), content_type='text/html'))
        detection.goto('https://www.amazon.co.uk/gp/buy/spc/')
        inject(detection)
        expect(detection.get_by_role('dialog')).to_be_visible()
        detection.goto(base + '/checkout-guard/test-checkout.html')
        detection.evaluate("document.body.innerHTML = '<h1>Headphones</h1><input type=search><p id=order-total>£65.00</p><button>Add to cart</button>'")
        detection.evaluate("""() => {
          window.__buttonReads = 0;
          const original = HTMLElement.prototype.getBoundingClientRect;
          HTMLElement.prototype.getBoundingClientRect = function (...args) {
            if (this.tagName === 'BUTTON') window.__buttonReads++;
            return original.apply(this, args);
          };
        }""")
        inject(detection)
        detection.wait_for_timeout(300)
        expect(detection.locator('#checkout-guard-overlay')).to_have_count(0)
        assert detection.evaluate('window.__buttonReads') == 0
        detection.goto(base + '/checkout-guard/test-checkout.html')
        detection.evaluate("Object.defineProperty(document, 'hidden', {value: true, configurable: true})")
        inject(detection)
        detection.wait_for_timeout(300)
        expect(detection.locator('#checkout-guard-overlay')).to_have_count(0)
        detection.evaluate("Object.defineProperty(document, 'hidden', {value: false, configurable: true});document.dispatchEvent(new Event('visibilitychange'))")
        expect(detection.get_by_role('dialog')).to_be_visible()
        print('PASS detection: domain boundaries, Amazon checkout, product-page fast path, hidden-tab deferral')

        # Shopify one-page checkout: card inputs are cross-origin frames, not top-level inputs.
        shopify = extension.new_page()
        shopify.route('https://checkout.pci.shopifyinc.com/**', lambda route: route.fulfill(body='<html></html>', content_type='text/html'))
        shopify.route('https://gamersupps.gg/**', lambda route: route.fulfill(body='''<!doctype html><html><body>
          <main><h1>Gamer Supps Checkout</h1><form>
            <iframe title="Card number" name="card-fields-number-test" src="https://checkout.pci.shopifyinc.com/build/test/number-ltr.html"></iframe>
            <div data-testid="onepage-pay-button-cluster"><button type="button" id="checkout-pay-button">Pay now £40.00</button></div>
          </form></main></body></html>''', content_type='text/html'))
        shopify.goto('https://gamersupps.gg/checkouts/cn/synthetic-test-order/en-gb')
        inject(shopify)
        expect(shopify.get_by_role('dialog')).to_be_visible()
        expect(shopify.locator('#cg-order-amount')).to_have_text('£40.00')
        shopify.locator('#cg-close').click()
        shopify.locator('#checkout-pay-button').evaluate("el => el.textContent = 'Pay now $40.00'")
        expect(shopify.locator('#cg-manual')).to_be_visible()
        print('PASS GamerSupps/Shopify: framed payment fields, one-page payment action, GBP total and foreign-currency fallback')

        popup = extension.new_page()
        popup.goto(base + '/checkout-guard/popup.html')
        expect(popup.locator('#saveBtn')).to_be_enabled()
        spent = popup.get_by_label('Current month spend (£)')
        budget = popup.get_by_label('Monthly budget (£)')
        for spend, percentage, remaining, zone in [('120', '40% spent', '£180.00', 'safe'), ('240', '80% spent', '£60.00', 'warning'), ('360', '120% spent', '£0.00', 'danger')]:
            spent.fill(spend)
            expect(popup.locator('#percentDisplay')).to_have_text(percentage)
            expect(popup.locator('#remainingAmount')).to_have_text(remaining)
            expect(popup.locator('#budgetProgress')).to_have_attribute('data-zone', zone)
        popup.evaluate('window.__failWrite = true')
        popup.locator('#saveBtn').click()
        expect(popup.locator('#statusToast')).to_contain_text('Could not save')
        expect(spent).to_have_value('360')
        popup.evaluate('window.__failWrite = false')
        popup.locator('#saveBtn').click()
        expect(popup.locator('#statusToast')).to_contain_text('Settings saved')
        popup.reload()
        expect(spent).to_have_value('360')
        budget.fill('0')
        expect(popup.locator('#percentDisplay')).to_have_text('Check amounts')
        popup.get_by_role('switch').uncheck()
        expect(popup.locator('#guardStatus')).to_have_text('Guard off')
        assert popup.evaluate("JSON.parse(localStorage.getItem('test-settings')).isEnabled") is False
        popup.locator('#resetBtn').click()
        expect(budget).to_have_value('300')
        expect(spent).to_have_value('120')
        expect(popup.get_by_role('switch')).to_be_checked()
        # Set the failure flag before scripts load, including after navigation.
        popup.add_init_script('window.__failRead = true')
        popup.reload()
        expect(popup.locator('#retryLoad')).to_be_visible()
        expect(popup.locator('#saveBtn')).to_be_disabled()
        popup.evaluate('window.__failRead = false')
        popup.locator('#retryLoad').click()
        expect(popup.locator('#saveBtn')).to_be_enabled()
        print('PASS popup: live amounts, storage save/reload, failed save retry, failed load retry, invalid amounts, independent on/off, reset')

        plain = context.new_page()
        plain.goto(base + '/checkout-guard/popup.html')
        expect(plain.locator('#statusToast')).to_contain_text('Preview mode')
        plain.get_by_label('Current month spend (£)').fill('250')
        plain.locator('#saveBtn').click()
        expect(plain.locator('#statusToast')).to_contain_text('not saved')
        assert not errors, errors
        browser.close()
        print('PASS no browser JavaScript errors')
finally:
    server.shutdown()
    server.server_close()
