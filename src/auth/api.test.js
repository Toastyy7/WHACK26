import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api.js';

const reply = (status, body, type = 'application/json') => async () => new Response(body === null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': type } });

test('api reports offline instead of throwing when no accounts server answers', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  assert.deepEqual(await api('me'), { offline: true });
  globalThis.fetch = reply(404, '<h1>Not found</h1>', 'text/html');  // python http.server / static host
  assert.deepEqual(await api('me'), { offline: true });
  globalThis.fetch = reply(401, { error: 'Not logged in.' });
  assert.deepEqual(await api('me'), { ok: false, status: 401, data: { error: 'Not logged in.' } });
  globalThis.fetch = reply(204, null);
  assert.deepEqual(await api('logout', {}), { ok: true, status: 204, data: {} });
});

test('api sends JSON posts with the session cookie', async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let seen;
  globalThis.fetch = async (url, options) => { seen = { url, options }; return reply(200, { user: { id: '1', username: 'emil' } })(); };
  const result = await api('login', { username: 'emil', password: 'pw' });
  assert.equal(result.data.user.username, 'emil');
  assert.equal(seen.url, '/api/login');
  assert.equal(seen.options.method, 'POST');
  assert.equal(seen.options.credentials, 'same-origin');
  assert.equal(seen.options.headers['Content-Type'], 'application/json');
});
