"""Payment tracking browser regression; uses the check-browser.py Playwright setup."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
from playwright.sync_api import sync_playwright, expect

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root / 'dist')))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH'), args=['--no-sandbox'])
        page = browser.new_page(timezone_id='Europe/London')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.clock.install(time=__import__('datetime').datetime(2026, 11, 8, 12, tzinfo=__import__('datetime').timezone.utc))
        page.goto(f'http://127.0.0.1:{server.server_port}')
        card = page.get_by_role('region', name='Payment due', exact=True)
        expect(card.get_by_text('No payment details added.')).to_be_visible()
        card.get_by_role('button', name='Add payment details').click()
        card.get_by_label('Amount due (£)').fill('0')
        card.get_by_label('Payment due date').fill('2026-11-13')
        card.get_by_role('button', name='Save payment details').click()
        expect(card.get_by_role('alert')).to_contain_text('Enter an amount above £0')
        card.get_by_label('Amount due (£)').fill('25.01')
        card.get_by_role('button', name='Save payment details').click()
        expect(card).to_contain_text('£25.01 due 13 Nov 2026')
        expect(card).to_contain_text('Due in 5 days')
        # Tracking does not alter owed/safe money.
        overview = page.get_by_role('region', name='Account overview')
        expect(overview).to_contain_text('£280.00')
        expect(overview).to_contain_text('£20.00')
        page.reload()
        expect(card).to_contain_text('£25.01 due 13 Nov 2026')
        page.get_by_role('button', name='Focus mode', exact=True).click()
        modal = page.get_by_role('dialog')
        modal.get_by_role('button', name='Show my summary').click()
        modal.get_by_role('button', name='Next', exact=True).click()
        expect(modal.get_by_role('heading', name='Payment due', exact=True)).to_be_visible()
        expect(modal).to_contain_text('£25.01')
        expect(modal).to_contain_text('Due in 5 days')
        # Dynamic step count reaches actions without skipping the category step.
        for _ in range(4):
            modal.get_by_role('button', name='Next', exact=True).click()
        expect(modal.get_by_role('button', name='Finish for now')).to_be_visible()
        modal.get_by_role('button', name='Finish for now').click()
        card.get_by_role('button', name='Edit payment details').click()
        card.get_by_label('Payment due date').fill('2026-11-08')
        card.get_by_role('button', name='Save payment details').click()
        expect(card.get_by_text('Due today', exact=True)).to_be_visible()
        page.clock.fast_forward(86400000)
        expect(card.get_by_text('Past due date', exact=True)).to_be_visible()
        card.get_by_role('button', name='Clear payment details').click()
        page.reload()
        expect(card.get_by_text('No payment details added.')).to_be_visible()
        # Storage failure remains useful for this visit and gives a clear message.
        page.evaluate("() => { Storage.prototype.setItem = function() { throw new Error('blocked'); }; }")
        card.get_by_role('button', name='Add payment details').click()
        card.get_by_label('Amount due (£)').fill('10')
        card.get_by_label('Payment due date').fill('2026-11-13')
        card.get_by_role('button', name='Save payment details').click()
        expect(card.get_by_role('alert')).to_contain_text('could not be saved')
        page.reload()
        card.get_by_role('button', name='Add payment details').click()
        card.get_by_label('Amount due (£)').fill('10')
        card.get_by_label('Payment due date').fill('2026-11-13')
        card.get_by_role('button', name='Save payment details').click()
        page.set_viewport_size({'width': 360, 'height': 640})
        for theme in ['light', 'dark']:
            page.evaluate('(theme) => document.documentElement.dataset.theme = theme', theme)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.get_by_role('button', name='Reset demo', exact=True).click()
        page.reload()
        expect(card.get_by_text('No payment details added.')).to_be_visible()
        assert not errors, errors
        browser.close()
        print('PASS payment due: validation, persistence, unchanged balance, Focus steps, midnight update, clear, storage failure, mobile themes and reset')
finally:
    server.shutdown()
