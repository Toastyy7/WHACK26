// Accounts server: register / log in / log out, plus serving the built dashboard (dist/).
// Zero dependencies. Local demo only: plain HTTP, never deploy as-is (see docs/BACKEND-PLAN.md).
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hashPassword, openStore, tokenHash, validPassword, validUsername, verifyPassword } from './store.js';

const COOKIE = 'cg_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY = 16 * 1024;
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

async function readJson(req) {
  if (!(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request too large.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new HttpError(400, 'Send a JSON object.'); }
}

export async function startServer({ port = 4173, host = '127.0.0.1', dataFile, distDir, devOrigins = [] } = {}) {
  const store = await openStore(dataFile);
  const dist = resolve(distDir);
  const failures = new Map();  // `${ip}|${username}` → { count, since }
  // Same timing for unknown users and wrong passwords, so login doesn't reveal who has an account.
  const dummyHash = await hashPassword(randomBytes(16).toString('hex'));

  function sessionCookie(token, maxAgeSeconds) {
    return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
  }
  async function startSession(res, status, user) {
    const token = randomBytes(32).toString('base64url');
    await store.addSession(tokenHash(token), user.id, Date.now() + SESSION_MS);
    sendJson(res, status, { user: { id: user.id, username: user.username } }, { 'Set-Cookie': sessionCookie(token, SESSION_MS / 1000) });
  }
  function credentials(body) {
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    return { username, password: body.password };
  }
  function checkOrigin(req) {
    const origin = req.headers.origin;
    if (origin !== `http://${req.headers.host}` && !devOrigins.includes(origin)) throw new HttpError(403, 'Request blocked: unexpected origin.');
  }

  const routes = {
    'GET /api/health': async (req, res) => sendJson(res, 200, { ok: true }),
    'GET /api/me': async (req, res) => {
      const token = readCookie(req, COOKIE);
      const user = token && store.userForSession(tokenHash(token));
      if (!user) throw new HttpError(401, 'Not logged in.');
      sendJson(res, 200, { user: { id: user.id, username: user.username } });
    },
    'POST /api/register': async (req, res) => {
      const { username, password } = credentials(await readJson(req));
      if (!validUsername(username)) throw new HttpError(400, 'Username must be 3–32 characters: letters, numbers, dots, dashes or underscores.');
      if (!validPassword(password)) throw new HttpError(400, 'Password must be 8–128 characters.');
      if (store.findUser(username)) throw new HttpError(409, 'That username is taken.');
      const user = await store.addUser(username, await hashPassword(password));
      if (!user) throw new HttpError(409, 'That username is taken.');
      await startSession(res, 201, user);
    },
    'POST /api/login': async (req, res) => {
      const { username, password } = credentials(await readJson(req));
      const key = `${req.socket.remoteAddress}|${username}`;
      const now = Date.now();
      const recent = failures.get(key);
      if (recent && now - recent.since < LOGIN_WINDOW_MS && recent.count >= LOGIN_LIMIT) {
        throw new HttpError(429, 'Too many attempts. Wait 15 minutes and try again.');
      }
      const user = store.findUser(username);
      const ok = await verifyPassword(typeof password === 'string' ? password : '', user?.passwordHash ?? dummyHash) && Boolean(user);
      if (!ok) {
        const fresh = !recent || now - recent.since >= LOGIN_WINDOW_MS;
        failures.set(key, { count: fresh ? 1 : recent.count + 1, since: fresh ? now : recent.since });
        throw new HttpError(401, 'Username or password is wrong.');
      }
      failures.delete(key);
      await startSession(res, 200, user);
    },
    'POST /api/logout': async (req, res) => {
      const token = readCookie(req, COOKIE);
      if (token) await store.removeSession(tokenHash(token));
      sendJson(res, 204, undefined, { 'Set-Cookie': sessionCookie('', 0) });
    },
  };

  async function serveStatic(req, res) {
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { throw new HttpError(400, 'Bad address.'); }
    let file = resolve(join(dist, path));
    // Never serve anything outside dist/ (path traversal).
    if (file !== dist && !file.startsWith(dist + sep)) throw new HttpError(404, 'Not found.');
    if (path.endsWith('/') || !extname(file)) file = join(dist, 'index.html');  // single-page app fallback
    try {
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      res.end(content);
    } catch {
      throw new HttpError(404, file.endsWith('index.html') ? 'Dashboard not built. Run npm run build first.' : 'Not found.');
    }
  }

  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://x').pathname;
      if (!path.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
        return await serveStatic(req, res);
      }
      const route = routes[`${req.method} ${path}`];
      if (!route) throw new HttpError(404, 'Not found.');
      if (req.method === 'POST') checkOrigin(req);
      await route(req, res);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error('[server]', error);  // never logs request bodies or passwords
      if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'Something went wrong on the server.' : error.message });
      else res.end();
    }
  });
  await new Promise((done) => server.listen(port, host, done));
  return server;
}

// `npm run server` (add `-- --lan` to allow other devices on the same Wi-Fi).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const lan = process.argv.includes('--lan');
  const port = Number(process.env.PORT ?? 4173);
  try {
    const server = await startServer({
      port, host: lan ? '0.0.0.0' : '127.0.0.1',
      // ACCOUNTS_FILE lets tests use a throwaway file instead of the real one.
      dataFile: process.env.ACCOUNTS_FILE ?? join(root, 'server', 'data', 'users.json'),
      distDir: join(root, 'dist'),
      devOrigins: ['http://127.0.0.1:5173', 'http://localhost:5173'],
    });
    const { port: actual } = server.address();
    console.log(`Accounts server: http://127.0.0.1:${actual}  (dashboard + /api)`);
    if (lan) console.warn('⚠ --lan: reachable by other devices on this network over plain HTTP. Demo only.');
  } catch (error) {
    console.error(`Could not start the server: ${error.message}`);
    process.exit(1);
  }
}
