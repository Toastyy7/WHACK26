import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStatementReader } from './loadStatementReader.js';

const module = { readStatement() {} };
test('successful reader loading does not retry', async () => {
  let retries = 0;
  const result = await loadStatementReader({}, [async () => module, async () => { retries++; }]);
  assert.equal(result, module);
  assert.equal(retries, 0);
});
test('a failed module load retries once without reading the file or reloading the page', async () => {
  const events = [];
  const result = await loadStatementReader({ onRetry: () => events.push('notice') }, [
    async () => { events.push('initial'); throw new TypeError('Failed to fetch dynamically imported module'); },
    async () => { events.push('retry'); return module; },
  ]);
  assert.equal(result, module);
  assert.deepEqual(events, ['initial', 'notice', 'retry']);
});
test('two failed loads give recovery instructions and preserve the underlying error', async () => {
  const failure = new TypeError('Network error');
  let attempts = 0;
  const fail = async () => { attempts++; throw failure; };
  await assert.rejects(loadStatementReader({}, [fail, fail]), error => {
    assert.match(error.message, /statement reader could not load/);
    assert.match(error.message, /npm run dev/);
    assert.match(error.message, /refresh/);
    assert.equal(error.cause, failure);
    return true;
  });
  assert.equal(attempts, 2);
});
test('cancelled uploads do not start or retry the reader and discard late imports', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadStatementReader({ signal: controller.signal }, [() => assert.fail('must not import')]), { name: 'AbortError' });
  for (const reject of [false, true]) {
    const active = new AbortController();
    await assert.rejects(loadStatementReader({ signal: active.signal }, [async () => {
      active.abort();
      if (reject) throw new Error('fetch failed');
      return module;
    }, () => assert.fail('must not retry')]), { name: 'AbortError' });
  }
});
