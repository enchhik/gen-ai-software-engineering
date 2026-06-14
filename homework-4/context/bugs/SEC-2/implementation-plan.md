# SEC-2 — Implementation Plan

## 1. Goal

Replace the hardcoded HMAC secret with an environment variable and replace the no-op `hashPassword` / `verifyPassword` with `crypto.scryptSync`-based hashing so that passwords are never stored in plaintext.

---

## 2. Affected Files

- `src/auth.js`

No changes required to `src/routes/auth.js`, `src/db.js`, or any test file: both callers already invoke `hashPassword` and `verifyPassword` by reference, so updating the implementations propagates automatically.

---

## 3. Changes

### `src/auth.js`

**before**
```js
import crypto from 'node:crypto';

// SEC-2: hardcoded secret. Intended fix: read from process.env.AUTH_SECRET.
const SECRET = 'hw4-super-secret-key';

// SEC-2: plaintext storage. Intended fix: crypto.scrypt-based hashing.
export function hashPassword(plain) {
  return plain;
}

export function verifyPassword(plain, stored) {
  return plain === stored;
}

export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig !== expected) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { return null; }
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  req.user = payload;
  next();
}
```

**after**
```js
import crypto from 'node:crypto';

const SECRET = process.env.AUTH_SECRET || 'hw4-super-secret-key';

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plain, stored) {
  const [salt, hash] = stored.split(':');
  const derived = crypto.scryptSync(plain, salt, 64);
  return crypto.timingSafeEqual(derived, Buffer.from(hash, 'hex'));
}

export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig !== expected) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
  catch { return null; }
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  req.user = payload;
  next();
}
```

---

## 4. Verification Command

```bash
npm test
```

All 42 tests must pass (0 failures).

---

## 5. Invariants

- `POST /auth/login returns a token for valid credentials` (`tests/auth.routes.test.js:35–41`) must remain green. It logs in with `alice@example.com` / `alice-pass`. Because the in-memory DB is re-seeded fresh on every test run by calling `hashPassword('alice-pass')`, the stored value will be a `salt:hash` string, and the login path calls `verifyPassword('alice-pass', stored)` which re-derives the same scrypt hash — so the round-trip holds.
- `verifyPassword returns true for matching password` (`tests/auth.helpers.test.js:5–8`) must remain green: `hashPassword` produces a `salt:hash` string and `verifyPassword` re-derives and compares correctly.
- `verifyPassword returns false for mismatched password` (`tests/auth.helpers.test.js:10–13`) must remain green: `verifyPassword` with a different plaintext will produce a different 64-byte derived key, and `timingSafeEqual` will return false.
- `signToken / verifyToken roundtrip preserves payload` and `verifyToken returns null on tampered token` (`tests/auth.helpers.test.js:15–26`) are unaffected because `signToken`/`verifyToken` code is unchanged.
