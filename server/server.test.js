import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './index.js';

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'cg-server-'));
  await mkdir(join(dir, 'dist'));
  await writeFile(join(dir, 'dist', 'index.html'), '<h1>dashboard</h1>');
  await writeFile(join(dir, 'secret.txt'), 'outside dist');
  const dataFile = join(dir, 'data', 'users.json');
  const server = await startServer({ port: 0, dataFile, distDir: join(dir, 'dist') });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = 'GET', body, cookie, origin = base, type = 'application/json' } = {}) => fetch(base + path, {
    method,
    headers: { ...(body !== undefined && { 'Content-Type': type }), ...(cookie && { Cookie: cookie }), ...(method !== 'GET' && origin && { Origin: origin }) },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const cookieOf = (response) => response.headers.get('set-cookie')?.split(';')[0];
  return { server, base, call, cookieOf, dataFile, close: () => new Promise((done) => server.close(done)) };
}

test('register logs you in, me knows you, logout ends the session', async () => {
  const { call, cookieOf, close } = await setup();
  try {
    const registered = await call('/api/register', { method: 'POST', body: { username: '  Emil ', password: 'correct horse' } });
    assert.equal(registered.status, 201);
    assert.equal((await registered.json()).user.username, 'emil');  // trimmed and lowercased
    const setCookie = registered.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    const cookie = cookieOf(registered);
    assert.equal((await (await call('/api/me', { cookie })).json()).user.username, 'emil');
    assert.equal((await call('/api/logout', { method: 'POST', cookie })).status, 204);
    assert.equal((await call('/api/me', { cookie })).status, 401);  // old cookie no longer works
  } finally { await close(); }
});

test('login checks the password with one message for every failure', async () => {
  const { call, cookieOf, close } = await setup();
  try {
    await call('/api/register', { method: 'POST', body: { username: 'alex', password: 'long enough' } });
    const wrong = await call('/api/login', { method: 'POST', body: { username: 'alex', password: 'not it at all' } });
    const unknown = await call('/api/login', { method: 'POST', body: { username: 'nobody', password: 'long enough' } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(await wrong.json(), await unknown.json());  // doesn't reveal who has an account
    const ok = await call('/api/login', { method: 'POST', body: { username: 'ALEX', password: 'long enough' } });
    assert.equal(ok.status, 200);
    assert.equal((await (await call('/api/me', { cookie: cookieOf(ok) })).json()).user.username, 'alex');
  } finally { await close(); }
});

test('register validates input and refuses taken usernames', async () => {
  const { call, close } = await setup();
  try {
    for (const body of [{ username: 'ab', password: 'long enough' }, { username: 'bad name', password: 'long enough' },
      { username: 'fine', password: 'short' }, { username: 'fine', password: 'x'.repeat(129) }, { username: 'fine' }]) {
      assert.equal((await call('/api/register', { method: 'POST', body })).status, 400, JSON.stringify(body));
    }
    assert.equal((await call('/api/register', { method: 'POST', body: { username: 'taken', password: 'long enough' } })).status, 201);
    assert.equal((await call('/api/register', { method: 'POST', body: { username: 'TAKEN', password: 'other password' } })).status, 409);
  } finally { await close(); }
});

test('passwords are stored hashed, sessions only as hashes', async () => {
  const { call, cookieOf, dataFile, close } = await setup();
  try {
    const response = await call('/api/register', { method: 'POST', body: { username: 'priv', password: 'super secret pw' } });
    const token = cookieOf(response).split('=')[1];
    const file = await readFile(dataFile, 'utf8');
    assert.ok(!file.includes('super secret pw'));
    assert.ok(!file.includes(token));
    assert.match(file, /scrypt\$/);
  } finally { await close(); }
});

test('blocks other origins, non-JSON, oversized bodies and brute force', async () => {
  const { call, close } = await setup();
  try {
    const body = { username: 'target', password: 'long enough' };
    assert.equal((await call('/api/register', { method: 'POST', body, origin: 'http://evil.example' })).status, 403);
    assert.equal((await call('/api/register', { method: 'POST', body, origin: null })).status, 403);
    assert.equal((await call('/api/register', { method: 'POST', body: 'username=x', type: 'application/x-www-form-urlencoded' })).status, 415);
    assert.equal((await call('/api/register', { method: 'POST', body: { username: 'x'.repeat(20000) } })).status, 413);
    assert.equal((await call('/api/register', { method: 'POST', body: '{not json' })).status, 400);
    await call('/api/register', { method: 'POST', body });
    for (let i = 0; i < 5; i += 1) await call('/api/login', { method: 'POST', body: { ...body, password: 'wrong guess!' } });
    assert.equal((await call('/api/login', { method: 'POST', body })).status, 429);  // even the right password waits
  } finally { await close(); }
});

test('serves the dashboard, falls back to it, and never serves files outside dist', async () => {
  const { base, call, close } = await setup();
  try {
    assert.equal(await (await call('/')).text(), '<h1>dashboard</h1>');
    assert.equal(await (await call('/statements')).text(), '<h1>dashboard</h1>');  // app routes
    const escape = await fetch(`${base}/..%2Fsecret.txt`);
    assert.notEqual(await escape.text(), 'outside dist');
    assert.equal((await call('/api/health')).status, 200);
    assert.equal((await call('/api/nope')).status, 404);
  } finally { await close(); }
});

test('refuses to start over a corrupt accounts file instead of wiping it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cg-server-'));
  const dataFile = join(dir, 'users.json');
  await writeFile(dataFile, '{"users": "oops"');
  await assert.rejects(startServer({ port: 0, dataFile, distDir: dir }), /Refusing|refusing/);
  assert.equal(await readFile(dataFile, 'utf8'), '{"users": "oops"');
});
