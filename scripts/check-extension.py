"""Browser regression checks. Requires Python Playwright and Chromium.

Run: python scripts/check-extension.py
Chrome storage is simulated; this does not load an unpacked extension.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/checkout-guard/test-checkout.html'
errors = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script('''
          window.chrome = {...window.chrome, storage: {local: {
            get(defaults, callback) {
              callback({...defaults, cooldownSeconds: 1});
            }
          }}};
        ''')
        for total in ['£1,234.56', '£69.99', '£0.00']:
            page.goto(url)
            page.locator('#order-total').evaluate('(el, total) => el.textContent = total', total)
            page.add_script_tag(path=str(ROOT / 'checkout-guard/content.js'))
            expect(page.locator('.cg-impact-row').first).to_contain_text(total.replace(',', ''))
        proceed = page.locator('#cg-proceed')
        expect(proceed).to_be_enabled(timeout=3000)
        proceed.click()
        # The overlay's removal and unrelated page updates must not restart it.
        page.locator('#name').evaluate("el => el.insertAdjacentHTML('afterend', '<p>Address checked</p>')")
        page.wait_for_timeout(1800)
        expect(page.locator('#checkout-guard-overlay')).to_have_count(0)
        # A different order total should still receive a new warning.
        page.locator('#order-total').evaluate("el => el.textContent = '£80.00'")
        expect(page.locator('#checkout-guard-overlay')).to_be_visible(timeout=4000)
        expect(page.locator('.cg-impact-row').first).to_contain_text('£80.00')
        assert not errors, errors
        browser.close()
        print('PASS: grouped prices, zero price, Continue stays dismissed, changed total prompts again, no JS errors')
finally:
    server.shutdown()
    server.server_close()
