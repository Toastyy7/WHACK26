"""Vite dev-server statement-reader recovery checks (no personal files required).

Use the Playwright setup from requirements-browser.txt. Set CHROMIUM_PATH to use
an existing Chromium executable. The test starts its own Vite server with an
isolated temporary dependency cache and shuts it down afterwards.
"""
import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
STATEMENT_KEY = 'credit-guard-statement-v1'
SAVED = {
    'version': 1, 'fileName': 'previous-test-statement.pdf', 'savedAt': 1,
    'result': {'transactions': [{
        'id': 'previous', 'description': 'Previous test cafe', 'date': '01 Nov 2026',
        'isoDate': '2026-11-01', 'amount': 1000, 'category': 'Takeaways & dining',
        'included': True,
    }], 'pageCount': 1, 'supportedPages': 1, 'declaredTotal': 1000, 'unresolved': 0},
}


def open_analysis(context, url):
    page = context.new_page()
    page.route('**/api/me', lambda route: route.abort('failed'))
    page.goto(url)
    page.get_by_role('button', name='☰ Menu').click()
    page.get_by_label('Main navigation').get_by_role('button', name='Statement analysis', exact=True).click()
    page.evaluate("window.__uploadVisit = 'same-visit'")
    return page


def unchanged_visit(page):
    assert page.evaluate('window.__uploadVisit') == 'same-visit', 'Upload must not reload the dashboard'


with tempfile.TemporaryDirectory(prefix='whack-statement-dev-') as temporary:
    # An independent cache avoids changing a developer's existing optimizer state.
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    url = f'http://127.0.0.1:{port}/'
    runner = f'''
      import {{ createServer, mergeConfig }} from {json.dumps((ROOT / 'node_modules/vite/dist/node/index.js').as_uri())};
      import config from {json.dumps((ROOT / 'vite.config.js').as_uri())};
      const server = await createServer(mergeConfig(config, {{
        root: {json.dumps(str(ROOT))}, configFile: false,
        cacheDir: {json.dumps(str(Path(temporary) / 'vite-cache'))},
        server: {{ host: '127.0.0.1', port: {port}, strictPort: true, open: false, fs: {{ allow: [{json.dumps(str(ROOT))}, {json.dumps(temporary)}] }} }},
      }}));
      await server.listen();
      process.on('SIGTERM', async () => {{ await server.close(); process.exit(0); }});
    '''
    with open(Path(temporary) / 'vite.log', 'w+') as log:
        server = subprocess.Popen(['node', '--input-type=module', '-e', runner], cwd=ROOT, stdout=log, stderr=log)
        try:
            for _ in range(100):
                if server.poll() is not None:
                    log.seek(0)
                    raise RuntimeError('Vite failed to start:\n' + log.read())
                try:
                    urllib.request.urlopen(url, timeout=0.5).close()
                    break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError('Vite did not become ready')

            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), args=['--no-sandbox'])
                errors = []
                source = browser.new_page()
                source.set_content('''<style>
                  @page{size:1000px 500px;margin:0} body{margin:0;font:24px Arial}
                  span{position:absolute;white-space:nowrap}
                </style>
                <span style="left:40px;top:40px">Test statement</span>
                <span style="left:40px;top:90px">Money Out</span><span style="left:600px;top:90px">25.00</span>
                <span style="left:40px;top:160px">Date</span><span style="left:280px;top:160px">Description</span>
                <span style="left:600px;top:160px">Out</span><span style="left:720px;top:160px">In</span><span style="left:840px;top:160px">Balance</span>
                <span style="left:40px;top:220px">01/11/2026</span><span style="left:280px;top:220px">Test Cafe</span>
                <span style="left:600px;top:220px">25.00</span><span style="left:840px;top:220px">100.00</span>''')
                pdf = {'name': 'synthetic-statement.pdf', 'mimeType': 'application/pdf', 'buffer': source.pdf(print_background=True, prefer_css_page_size=True)}
                source.close()

                # First upload uses the actual cold Vite dependency graph, not dist.
                context = browser.new_context()
                context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
                page = open_analysis(context, url)
                page.get_by_label('GBP bank statement').set_input_files(pdf)
                expect(page.get_by_role('heading', name='Review before importing')).to_be_visible(timeout=30000)
                expect(page.get_by_label('Description for row 1')).to_have_value('Test Cafe')
                unchanged_visit(page)
                assert page.evaluate(f'localStorage.getItem({json.dumps(STATEMENT_KEY)})') is None
                context.close()
                print('PASS dev: cold first upload reaches review without reloading or saving')

                # A failed module URL is retried via a separate URL, keeping the File.
                context = browser.new_context()
                context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
                requests = []
                def fail_once(route):
                    requests.append(route.request.url)
                    if len(requests) == 1:
                        route.abort('failed')
                    else:
                        route.continue_()
                context.route('**/src/statements/readPdf.js*', fail_once)
                page = open_analysis(context, url)
                page.get_by_label('GBP bank statement').set_input_files(pdf)
                expect(page.get_by_role('heading', name='Review before importing')).to_be_visible(timeout=30000)
                assert len(requests) == 2 and requests[0] != requests[1], requests
                unchanged_visit(page)
                assert page.get_by_label('GBP bank statement').evaluate('(input) => input.files[0].name') == pdf['name']
                assert page.evaluate(f'localStorage.getItem({json.dumps(STATEMENT_KEY)})') is None
                context.close()
                print('PASS dev: one failed reader load retries once and retains the selected file')

                # Both failures produce guidance and preserve previously saved results.
                context = browser.new_context()
                context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
                context.add_init_script(f'if (location.origin === {json.dumps(url[:-1])}) localStorage.setItem({json.dumps(STATEMENT_KEY)}, {json.dumps(json.dumps(SAVED))})')
                failures = []
                def fail_both(route):
                    failures.append(route.request.url)
                    route.abort('failed')
                context.route('**/src/statements/readPdf.js*', fail_both)
                page = open_analysis(context, url)
                before = page.evaluate(f'localStorage.getItem({json.dumps(STATEMENT_KEY)})')
                page.get_by_label('GBP bank statement').set_input_files(pdf)
                alert = page.get_by_role('alert')
                expect(alert).to_contain_text('The statement reader could not load', timeout=15000)
                expect(alert).to_contain_text('npm run dev')
                expect(alert).to_contain_text('refresh')
                expect(alert).to_contain_text('Your previous saved statement has been kept')
                assert len(failures) == 2, failures
                assert page.evaluate(f'localStorage.getItem({json.dumps(STATEMENT_KEY)})') == before
                unchanged_visit(page)
                context.close()
                print('PASS dev: persistent load failure gives recovery guidance and preserves saved results')

                # Delay the module response until after Cancel/Reset to catch late work.
                for action in ['Cancel reading', 'Reset demo']:
                    context = browser.new_context()
                    context.on('page', lambda page: page.on('pageerror', lambda error: errors.append(str(error))))
                    pending = []
                    context.route('**/src/statements/readPdf.js*', lambda route: pending.append(route))
                    page = open_analysis(context, url)
                    page.get_by_label('GBP bank statement').set_input_files(pdf)
                    expect(page.get_by_role('button', name='Cancel reading', exact=True)).to_be_visible()
                    for _ in range(100):
                        if pending:
                            break
                        page.wait_for_timeout(20)
                    assert pending, 'Expected the delayed reader request'
                    page.get_by_role('button', name=action, exact=True).click()
                    for route in pending:
                        route.continue_()
                    page.wait_for_timeout(1000)
                    expect(page.get_by_role('heading', name='Review before importing')).to_have_count(0)
                    assert page.evaluate(f'localStorage.getItem({json.dumps(STATEMENT_KEY)})') is None
                    context.close()
                assert not errors, errors
                browser.close()
                print('PASS dev: Cancel and Reset suppress late imports and do not save results')
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
