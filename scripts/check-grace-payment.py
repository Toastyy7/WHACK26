"""Grace/payment integration browser regression (synthetic demo data only).

Run after npm run build with the Playwright setup in requirements-browser.txt.
Set CHROMIUM_PATH to use an existing Chromium binary.
"""
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import shutil
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
PAYMENT_KEY = 'credit-guard-payment-due-v1'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def navigate(page, label):
    page.get_by_role('button', name='☰ Menu', exact=True).click()
    page.get_by_label('Main navigation').get_by_role('button', name=label, exact=True).click()


def add_payment(page, date, amount='25.01'):
    card = page.get_by_role('region', name='Payment due', exact=True)
    card.get_by_role('button', name='Add payment details', exact=True).click()
    card.get_by_label('Amount due (£)').fill(amount)
    card.get_by_label('Payment due date').fill(date)
    card.get_by_role('button', name='Save payment details', exact=True).click()
    return card


def decide(page, accepted, double_click=False):
    navigate(page, 'Request Grace')
    grace = page.locator('section.card').filter(has=page.get_by_role('heading', name='Request Grace', level=2, exact=True))
    grace.get_by_role('button', name='Request Grace', exact=True).click()
    grace.get_by_role('button', name='Review message', exact=True).click()
    grace.get_by_role('button', name='Continue to regulatory disclaimer', exact=True).click()
    modal = page.get_by_role('dialog', name='Before you request grace')
    modal.get_by_role('checkbox').check()
    modal.get_by_role('button', name='Confirm and send', exact=True).click()
    page.clock.fast_forward(400)
    update = grace.get_by_role('button', name='Update request status', exact=True)
    expect(update).to_be_visible()
    update.click()
    expect(grace).to_contain_text('Your request is being reviewed')
    page.evaluate('(value) => { Math.random = () => value; }', 0 if accepted else 0.9)
    if double_click:
        # Both events occur before React can render away the terminal action.
        update.evaluate('(button) => { button.click(); button.click(); }')
    else:
        update.click()
    expect(grace).to_contain_text('Grace request accepted' if accepted else 'Grace request declined')
    expect(update).to_have_count(0)
    return grace


def saved_payment(page):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', PAYMENT_KEY)


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), args=['--no-sandbox'])
        errors = []

        def new_visit():
            context = browser.new_context(timezone_id='Europe/London')
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.clock.install(time=datetime(2026, 11, 8, 12, tzinfo=timezone.utc))
            page.goto(f'http://127.0.0.1:{server.server_port}/')
            return context, page

        context, page = new_visit()
        add_payment(page, '2026-11-13')
        grace = decide(page, accepted=True, double_click=True)
        expect(grace).to_contain_text('Payment due date moved to 27 Nov 2026')
        assert saved_payment(page) == {'amount': 2501, 'date': '2026-11-27'}
        navigate(page, 'Home')
        card = page.get_by_role('region', name='Payment due', exact=True)
        expect(card).to_contain_text('£25.01 due 27 Nov 2026')
        overview = page.get_by_role('region', name='Account overview')
        expect(overview).to_contain_text('£280.00')
        expect(overview).to_contain_text('£20.00')
        page.get_by_role('button', name='Focus mode', exact=True).click()
        focus = page.get_by_role('dialog')
        focus.get_by_role('button', name='Show my summary', exact=True).click()
        focus.get_by_role('button', name='Next', exact=True).click()
        expect(focus.get_by_role('heading', name='Payment due', exact=True)).to_be_visible()
        expect(focus).to_contain_text('£25.01')
        expect(focus).to_contain_text('27 Nov 2026')
        focus.get_by_role('button', name='Close focus mode', exact=True).click()
        navigate(page, 'Request Grace')
        expect(page.get_by_role('button', name='Update request status', exact=True)).to_have_count(0)
        assert saved_payment(page)['date'] == '2026-11-27'
        navigate(page, 'Home')
        page.reload()
        expect(card).to_contain_text('£25.01 due 27 Nov 2026')
        assert saved_payment(page)['date'] == '2026-11-27'
        page.get_by_role('button', name='Reset demo', exact=True).click()
        page.reload()
        expect(card).to_contain_text('No payment details added.')
        assert saved_payment(page) is None
        context.close()
        print('PASS grace: accepted future payment extends once, unchanged amount/balance, Home/Focus, persistence and Reset')

        for original in ['2026-11-01', '2026-11-08']:
            context, page = new_visit()
            add_payment(page, original)
            decide(page, accepted=True)
            assert saved_payment(page) == {'amount': 2501, 'date': '2026-11-22'}
            context.close()
        print('PASS grace: past/today due dates extend from today rather than an old date')

        context, page = new_visit()
        add_payment(page, '2026-11-13')
        before = saved_payment(page)
        decide(page, accepted=False)
        assert saved_payment(page) == before
        navigate(page, 'Home')
        expect(page.get_by_role('region', name='Payment due', exact=True)).to_contain_text('£25.01 due 13 Nov 2026')
        context.close()
        print('PASS grace: decline leaves saved payment unchanged')

        context, page = new_visit()
        grace = decide(page, accepted=True)
        expect(grace).to_contain_text('Add payment details to track a due date')
        assert saved_payment(page) is None
        grace.get_by_role('button', name='Add payment details', exact=True).click()
        card = page.get_by_role('region', name='Payment due', exact=True)
        expect(card.get_by_label('Amount due (£)')).to_be_visible()
        expect(card.get_by_label('Amount due (£)')).to_be_focused()
        expect(card.get_by_label('Amount due (£)')).to_have_value('')
        expect(card.get_by_label('Payment due date')).to_have_value('')
        assert saved_payment(page) is None
        assert not errors, errors
        context.close()
        browser.close()
        print('PASS grace: no payment details are invented; prompt opens and focuses empty payment form')
finally:
    server.shutdown()
    server.server_close()
