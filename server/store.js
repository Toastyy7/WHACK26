// Accounts store: usernames, scrypt password hashes and hashed session tokens.
// Money data never comes here; it stays in the browser (see docs/BACKEND-PLAN.md).
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

export const validUsername = (value) => typeof value === 'string' && /^[a-z0-9._-]{3,32}$/.test(value);
export const validPassword = (value) => typeof value === 'string' && value.length >= 8 && value.length <= 128;
// Only the SHA-256 of a session token is stored, so a leaked file cannot be used to log in.
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [kind, salt, hash] = typeof stored === 'string' ? stored.split('$') : [];
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, SCRYPT);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validData(data) {
  return Array.isArray(data?.users) && data.users.every((user) => validUsername(user?.username) &&
    typeof user.id === 'string' && typeof user.passwordHash === 'string') &&
    data.sessions && typeof data.sessions === 'object' && !Array.isArray(data.sessions);
}

export async function openStore(file) {
  let data = { users: [], sessions: {} };
  try {
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Could not read ${file}: ${error.message}. Fix or move it; refusing to overwrite accounts.`);
  }
  if (!validData(data)) throw new Error(`${file} is not a valid accounts file. Refusing to overwrite it.`);

  // Writes are queued and atomic (temp file + rename), so a crash can't leave a half-written file.
  let writing = Promise.resolve();
  function save() {
    writing = writing.then(async () => {
      await mkdir(dirname(file), { recursive: true });
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
      await rename(temp, file);
    });
    return writing;
  }

  return {
    findUser: (username) => data.users.find((user) => user.username === username) ?? null,
    async addUser(username, passwordHash) {
      // Checked again here: two sign-ups for one name can race while passwords hash.
      if (data.users.some((user) => user.username === username)) return null;
      const user = { id: randomUUID(), username, passwordHash, createdAt: Date.now() };
      data.users.push(user);
      await save();
      return user;
    },
    async addSession(hash, userId, expiresAt, now = Date.now()) {
      for (const [key, session] of Object.entries(data.sessions)) if (session.expiresAt <= now) delete data.sessions[key];
      data.sessions[hash] = { userId, expiresAt };
      await save();
    },
    userForSession(hash, now = Date.now()) {
      const session = data.sessions[hash];
      if (!session || session.expiresAt <= now) return null;
      return data.users.find((user) => user.id === session.userId) ?? null;
    },
    async removeSession(hash) {
      if (!(hash in data.sessions)) return;
      delete data.sessions[hash];
      await save();
    },
  };
}
