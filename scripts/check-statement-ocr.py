"""Local OCR/review integration check; optional image paths are never copied into the repo.

Run after npm run build, using the same Python/Chromium setup as check-browser.py:
  python scripts/check-statement-ocr.py [statement.jpg ...]
"""
import base64
import os
import shutil
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'dist')))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors, external = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: external.append(request.url) if urlparse(request.url).scheme in ('http', 'https') and urlparse(request.url).hostname != '127.0.0.1' else None)
        page.goto(f'http://127.0.0.1:{server.server_port}/')
        page.get_by_role('button', name='☰ Menu').click()
        page.get_by_role('button', name='Statement analysis', exact=True).click()
        upload = page.get_by_label('GBP bank statement')

        # Generate a non-personal image statement with a purchase dated today.
        png = page.evaluate('''() => {
          const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 600;
          const c = canvas.getContext('2d'); c.fillStyle = 'white'; c.fillRect(0,0,1800,600);
          c.fillStyle = 'black'; c.font = '30px Arial';
          const now = new Date(); const date = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
          c.fillText('Test statement', 40, 70); c.fillText('Money Out', 40, 140); c.fillText('25.00', 1100, 140);
          c.fillText('Date',40,230); c.fillText('Description',350,230); c.fillText('Out',1100,230); c.fillText('In',1300,230); c.fillText('Balance',1500,230);
          c.fillText(date,40,310); c.fillText('Test Cafe',350,310); c.fillText('25.00',1100,310); c.fillText('100.00',1500,310);
          return canvas.toDataURL('image/png').split(',')[1];
        }''')
        image = {'name': 'synthetic-statement.png', 'mimeType': 'image/png', 'buffer': base64.b64decode(png)}
        upload.set_input_files(image)
        page.get_by_role('button', name='Cancel reading', exact=True).click()
        expect(page.get_by_role('heading', name='Review before importing')).to_have_count(0)
        assert page.evaluate("localStorage.getItem('credit-guard-statement-v1')") is None
        upload.set_input_files(image)
        expect(page.get_by_role('heading', name='Review before importing')).to_be_visible(timeout=90000)
        assert page.evaluate("localStorage.getItem('credit-guard-statement-v1')") is None
        page.get_by_role('button', name='Cancel import').click()
        assert page.evaluate("localStorage.getItem('credit-guard-statement-v1')") is None
        upload.set_input_files(image)
        expect(page.get_by_role('heading', name='Review before importing')).to_be_visible(timeout=90000)
        page.get_by_label('Include row 1', exact=True).check()
        page.get_by_label('Amount for row 1', exact=True).fill('30.00')
        expect(page.get_by_role('button', name='Confirm and import selected')).to_be_disabled()
        page.get_by_label('I have checked the selected amounts').check()
        page.get_by_role('button', name='Confirm and import selected').click()
        expect(page.get_by_role('heading', name='Review before importing')).to_have_count(0)
        page.get_by_role('button', name='View summary on Home').click()
        expect(page.get_by_role('region', name='Account overview')).to_contain_text('£310.00')
        expect(page.locator('.home-transactions')).to_contain_text('Test Cafe')
        expect(page.locator('.home-transactions')).to_contain_text('£30.00')
        page.get_by_role('button', name='Reset demo', exact=True).click()
        expect(page.locator('.home-transactions')).to_have_count(0)
        assert page.evaluate("localStorage.getItem('credit-guard-statement-v1')") is None
        print('PASS: local image OCR, review/cancel isolation, corrected amount import, dated balance, Reset demo')

        # A scanned PDF should take the same OCR path, not require embedded text.
        # Chromium's PDF print gives us a PDF with only the synthetic image in it.
        source = browser.new_page()
        source.set_content(f'<style>@page{{margin:0;size:1800px 600px}}body{{margin:0}}img{{width:1800px}}</style><img src="data:image/png;base64,{png}">')
        source.locator('img').wait_for()
        source.wait_for_function('document.images[0].complete')
        scanned = source.pdf(print_background=True, prefer_css_page_size=True)
        source.close()
        page.get_by_role('button', name='☰ Menu').click()
        page.get_by_role('button', name='Statement analysis', exact=True).click()
        upload.set_input_files({'name': 'scanned.pdf', 'mimeType': 'application/pdf', 'buffer': scanned})
        expect(page.get_by_role('heading', name='Review before importing')).to_be_visible(timeout=90000)
        assert page.evaluate("localStorage.getItem('credit-guard-statement-v1')") is None
        page.get_by_role('button', name='Cancel import').click()
        print('PASS: scanned PDF OCR and review gate')

        for path in sys.argv[1:]:
            upload.set_input_files(path)
            page.locator('.statement-review, [role=alert]').first.wait_for(state='visible', timeout=90000)
            expect(page.get_by_role('heading', name='Review before importing')).to_be_visible()
            assert page.locator('.statement-review tbody tr').count() > 0
            assert page.evaluate("localStorage.getItem('credit-guard-statement-v1')") is None
            print(f'PASS: example image {Path(path).name} reaches review without saving')
            page.get_by_role('button', name='Cancel import').click()
        assert not errors, errors
        assert not external, 'OCR must not request external services or CDNs'
        browser.close()
        print('PASS: no external requests or browser JavaScript errors')
finally:
    server.shutdown()
    server.server_close()
