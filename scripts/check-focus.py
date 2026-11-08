"""Built-dashboard Focus mode checks. Uses the same Playwright setup as check-browser.py."""
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
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}')
        opener = page.get_by_role('button', name='Focus mode', exact=True)
        opener.click()
        modal = page.get_by_role('dialog')
        expect(modal).to_be_visible()
        expect(modal.get_by_role('heading', name='Take a breather.')).to_be_visible()
        modal.get_by_role('button', name='Show my summary').click()
        expect(modal.get_by_text('£280.00', exact=True)).to_be_visible()
        modal.get_by_role('button', name='Back', exact=True).click()
        expect(modal.get_by_role('heading', name='Take a breather.')).to_be_visible()
        modal.get_by_role('button', name='Show my summary').click()
        # Keyboard focus cannot reach the background while the modal is open.
        for _ in range(8):
            page.keyboard.press('Tab')
            assert page.evaluate("document.querySelector('.focus-dialog').contains(document.activeElement)")
        modal.get_by_role('button', name='Next', exact=True).click()
        expect(modal.get_by_text('£20.00', exact=True)).to_be_visible()
        modal.get_by_role('button', name='Next', exact=True).click()
        expect(modal.get_by_text('No transactions recorded', exact=True)).to_be_visible()
        modal.get_by_role('button', name='Next', exact=True).click()
        expect(modal.get_by_text('No category to show yet', exact=True)).to_be_visible()
        modal.get_by_role('button', name='Next', exact=True).click()
        modal.get_by_role('button', name='Try a purchase amount').click()
        expect(modal).not_to_be_visible()
        expect(page.get_by_label('What would a purchase cost (£)?')).to_be_focused()
        opener.click()
        expect(modal.get_by_role('heading', name='Take a breather.')).to_be_visible()
        modal.get_by_role('button', name='Show my summary').click()
        expect(modal.get_by_text('£280.00', exact=True)).to_be_visible()
        page.keyboard.press('Escape')
        expect(opener).to_be_focused()
        opener.click()
        modal.get_by_role('button', name='Show my summary').click()
        for _ in range(4):
            modal.get_by_role('button', name='Next', exact=True).click()
        modal.get_by_role('button', name='Review recorded spending').click()
        expect(page.get_by_role('heading', name='Statement analysis', exact=True)).to_be_visible()
        page.get_by_role('button', name='Reset demo', exact=True).click()
        expect(opener).to_be_visible()
        # Optional breathing starts only on request; clock-driven checks avoid real waits.
        opener.click()
        page.clock.install()
        expect(modal.get_by_text('Breathe at your own pace.', exact=True)).to_be_visible()
        modal.get_by_role('button', name='Start breathing guide').click()
        expect(modal.get_by_text('Breathe in', exact=True)).to_be_visible()
        page.clock.fast_forward(4000)
        expect(modal.get_by_text('Breathe out', exact=True)).to_be_visible()
        modal.get_by_role('button', name='Pause breathing guide').click()
        page.clock.fast_forward(8000)
        expect(modal.get_by_text('Breathe at your own pace.', exact=True)).to_be_visible()
        modal.get_by_role('button', name='Start breathing guide').click()
        page.keyboard.press('Escape')
        opener.click()
        expect(modal.get_by_role('button', name='Start breathing guide')).to_be_visible()
        modal.get_by_role('button', name='Close focus mode').click()
        # Programmatic reset while open must also remove the modal.
        opener.click()
        page.get_by_role('button', name='Reset demo', exact=True).evaluate('(button) => button.click()')
        expect(page.get_by_role('dialog')).not_to_be_visible()
        page.set_viewport_size({'width': 360, 'height': 640})
        page.emulate_media(reduced_motion='reduce')
        for theme in ['light', 'dark']:
            page.evaluate('(theme) => document.documentElement.dataset.theme = theme', theme)
            opener.click()
            modal.get_by_role('button', name='Start breathing guide').click()
            assert modal.locator('.breathing-circle').evaluate('(el) => getComputedStyle(el).animationName') == 'none'
            box = modal.bounding_box()
            assert box['x'] >= 0 and box['x'] + box['width'] <= 360
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=f'/tmp/focus-{theme}.png')
            modal.get_by_role('button', name='Close focus mode').click()
        assert not errors, errors
        browser.close()
        print('Focus mode: navigation, focus trap/restore, empty data, actions, reset, phone width and themes passed.')
finally:
    server.shutdown()
