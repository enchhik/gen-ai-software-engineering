# Homework 4 — Sample App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the small Express "Users & Auth" REST API described in
`homework-4/docs/superpowers/specs/2026-05-24-hw4-sample-app-design.md`, with
the four seeded defects intact, ready to be processed by the homework-4 agent
pipeline (designed separately).

**Architecture:** Plain JavaScript ESM modules on Node. `createApp(db)` returns a
configured Express app (used by `supertest` in tests); `server.js` is the only
place that binds a port. SQLite via `better-sqlite3` provides a real database so
the seeded SQL-injection is genuine. Auth uses Node `crypto` HMAC tokens (no
extra dependency).

**Tech Stack:** Node ≥ 20, Express 4, better-sqlite3, `node:test` runner,
supertest. ESM (`"type": "module"`).

**Working directory for all tasks:** `homework-4/`. Run commands from there
unless noted.

**Note on seeded defects:** This plan implements the **before-state** of the
app. Two logical bugs (BUG-1 pagination, BUG-2 case-sensitive login) are
written on purpose; the tests for them assert the **intended** (fixed)
behaviour and are therefore **expected to be red** when the plan finishes. Two
security defects (SEC-1 SQL injection, SEC-2 hardcoded secret + plaintext
passwords) are also written on purpose; they do not necessarily fail unit
tests — they exist for the Security Verifier agent to find. After the
pipeline runs, all four are fixed and the whole suite goes green.

---

## File map

| Path | Responsibility |
|---|---|
| `homework-4/package.json` | scripts, deps (`express`, `better-sqlite3`), devDeps (`supertest`) |
| `homework-4/.gitignore` | ignore `node_modules`, `*.sqlite`, `.env` |
| `homework-4/src/db.js` | `createDb(path)` → schema + seed of 12 users |
| `homework-4/src/auth.js` | password helpers (insecure on purpose), HMAC token sign/verify (hardcoded secret on purpose), `requireAuth` middleware |
| `homework-4/src/routes/auth.js` | `POST /auth/register`, `POST /auth/login` |
| `homework-4/src/routes/users.js` | `GET /users`, `GET /users/search`, `GET /users/:id` |
| `homework-4/src/app.js` | `createApp(db)` builds & wires the express app |
| `homework-4/src/server.js` | entry point; binds port via `app.listen` |
| `homework-4/tests/db.test.js` | schema/seed sanity |
| `homework-4/tests/auth.routes.test.js` | register + login behaviour (includes BUG-2 red test) |
| `homework-4/tests/users.routes.test.js` | user list/search/get (includes BUG-1 red tests) |
| `homework-4/context/bugs/BUG-1/bug-context.md` | pagination defect description |
| `homework-4/context/bugs/BUG-2/bug-context.md` | case-sensitive login description |
| `homework-4/context/bugs/SEC-1/bug-context.md` | SQL injection description |
| `homework-4/context/bugs/SEC-2/bug-context.md` | hardcoded secret + plaintext passwords |

---

## Task 1: Scaffold the Node package

**Files:**
- Create: `homework-4/package.json`
- Create: `homework-4/.gitignore`
- Delete: `homework-4/src/.gitkeep` (existed from earlier scaffold; replaced by real files in later tasks)

- [ ] **Step 1: Create `homework-4/package.json`**

```json
{
  "name": "homework-4-sample-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test tests/"
  },
  "dependencies": {
    "express": "^4.21.0",
    "better-sqlite3": "^11.3.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create `homework-4/.gitignore`**

```
node_modules/
*.sqlite
.env
```

- [ ] **Step 3: Install dependencies**

Run (from `homework-4/`): `npm install`
Expected: lockfile created, `node_modules/` populated, no errors. `better-sqlite3` builds a native binding — must succeed.

- [ ] **Step 4: Confirm test runner wired**

Run: `npm test`
Expected: `tests/` does not exist yet → `node --test tests/` exits 0 with no tests found (or non-zero with "no test files"). Either outcome is fine; we just confirm `npm test` is plumbed.

- [ ] **Step 5: Commit**

```bash
git add homework-4/package.json homework-4/.gitignore homework-4/package-lock.json
git rm homework-4/src/.gitkeep
git commit -m "chore(homework-4): scaffold node package with express + sqlite"
```

---

## Task 2: Database module — schema + seed

**Files:**
- Create: `homework-4/src/db.js`
- Create: `homework-4/tests/db.test.js`

- [ ] **Step 1: Write the failing test (`homework-4/tests/db.test.js`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/db.js';

test('createDb seeds 12 users with id, email, name, password columns', () => {
  const db = createDb(':memory:');
  const rows = db.prepare('SELECT id, email, name, password FROM users ORDER BY id').all();
  assert.equal(rows.length, 12);
  assert.ok(rows[0].email.includes('@'));
  assert.ok(rows[0].name);
  assert.ok(rows[0].password);
});

test('seeded data includes a mixed-case email for BUG-2 demonstration', () => {
  const db = createDb(':memory:');
  const row = db.prepare("SELECT * FROM users WHERE email = 'Carol@example.com'").get();
  assert.ok(row, 'expected a seeded user with mixed-case email Carol@example.com');
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/db.js'`.

- [ ] **Step 3: Implement `homework-4/src/db.js`**

```js
import Database from 'better-sqlite3';

const SEED = [
  ['alice@example.com',   'Alice',    'alice-pass'],
  ['bob@example.com',     'Bob',      'bob-pass'],
  ['Carol@example.com',   'Carol',    'carol-pass'],
  ['dave@example.com',    'Dave',     'dave-pass'],
  ['eve@example.com',     'Eve',      'eve-pass'],
  ['frank@example.com',   'Frank',    'frank-pass'],
  ['grace@example.com',   'Grace',    'grace-pass'],
  ['heidi@example.com',   'Heidi',    'heidi-pass'],
  ['ivan@example.com',    'Ivan',     'ivan-pass'],
  ['judy@example.com',    'Judy',     'judy-pass'],
  ['mallory@example.com', 'Mallory',  'mallory-pass'],
  ['oscar@example.com',   'Oscar',    'oscar-pass'],
];

export function createDb(path = ':memory:') {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL
    );
  `);
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO users (email, name, password) VALUES (?, ?, ?)');
    const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
    tx(SEED);
  }
  return db;
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test`
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add homework-4/src/db.js homework-4/tests/db.test.js
git commit -m "feat(homework-4): add sqlite schema and 12-user seed"
```

---

## Task 3: Auth helpers (insecure on purpose — SEC-2)

**Files:**
- Create: `homework-4/src/auth.js`
- Create: `homework-4/tests/auth.helpers.test.js`

This module deliberately stores passwords in plaintext and uses a hardcoded
HMAC secret. The tests assert the helper's externally observable behaviour
(roundtrip), not the insecurity — Security Verifier finds the insecurity.

- [ ] **Step 1: Write the failing test (`homework-4/tests/auth.helpers.test.js`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../src/auth.js';

test('verifyPassword returns true for matching password', () => {
  const stored = hashPassword('pw123');
  assert.equal(verifyPassword('pw123', stored), true);
});

test('verifyPassword returns false for mismatched password', () => {
  const stored = hashPassword('pw123');
  assert.equal(verifyPassword('other', stored), false);
});

test('signToken / verifyToken roundtrip preserves payload', () => {
  const token = signToken({ id: 7, email: 'x@y.z' });
  const payload = verifyToken(token);
  assert.equal(payload.id, 7);
  assert.equal(payload.email, 'x@y.z');
});

test('verifyToken returns null on tampered token', () => {
  const token = signToken({ id: 7 });
  const tampered = token.slice(0, -2) + 'xx';
  assert.equal(verifyToken(tampered), null);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/auth.js'`.

- [ ] **Step 3: Implement `homework-4/src/auth.js`**

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

- [ ] **Step 4: Run, verify it passes**

Run: `npm test`
Expected: previous 2 db tests still pass, 4 new auth-helper tests pass.

- [ ] **Step 5: Commit**

```bash
git add homework-4/src/auth.js homework-4/tests/auth.helpers.test.js
git commit -m "feat(homework-4): add auth helpers (insecure on purpose for SEC-2)"
```

---

## Task 4: App skeleton + `POST /auth/register`

**Files:**
- Create: `homework-4/src/app.js`
- Create: `homework-4/src/routes/auth.js`
- Create: `homework-4/tests/auth.routes.test.js`

- [ ] **Step 1: Write the failing test (`homework-4/tests/auth.routes.test.js`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';

function makeApp() {
  return createApp(createDb(':memory:'));
}

test('POST /auth/register creates a user and returns 201', async () => {
  const app = makeApp();
  const res = await request(app).post('/auth/register')
    .send({ email: 'new@example.com', password: 'pw', name: 'New' });
  assert.equal(res.status, 201);
  assert.equal(res.body.email, 'new@example.com');
  assert.equal(res.body.name, 'New');
  assert.ok(res.body.id);
});

test('POST /auth/register requires email, password and name', async () => {
  const app = makeApp();
  const res = await request(app).post('/auth/register').send({ email: 'x@y.z' });
  assert.equal(res.status, 400);
});

test('POST /auth/register rejects duplicate email with 409', async () => {
  const app = makeApp();
  const body = { email: 'dup@example.com', password: 'pw', name: 'Dup' };
  await request(app).post('/auth/register').send(body);
  const res = await request(app).post('/auth/register').send(body);
  assert.equal(res.status, 409);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/app.js'`.

- [ ] **Step 3: Implement `homework-4/src/routes/auth.js`**

```js
import { Router } from 'express';
import { hashPassword, verifyPassword, signToken } from '../auth.js';

export function createAuthRouter(db) {
  const r = Router();

  r.post('/register', (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password and name are required' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'email already registered' });
    const info = db.prepare(
      'INSERT INTO users (email, name, password) VALUES (?, ?, ?)'
    ).run(email, name, hashPassword(password));
    res.status(201).json({ id: info.lastInsertRowid, email, name });
  });

  return r;
}
```

- [ ] **Step 4: Implement `homework-4/src/app.js`**

```js
import express from 'express';
import { createAuthRouter } from './routes/auth.js';

export function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter(db));
  return app;
}
```

- [ ] **Step 5: Run, verify it passes**

Run: `npm test`
Expected: all prior tests + 3 new register tests pass.

- [ ] **Step 6: Commit**

```bash
git add homework-4/src/app.js homework-4/src/routes/auth.js homework-4/tests/auth.routes.test.js
git commit -m "feat(homework-4): add app factory and POST /auth/register"
```

---

## Task 5: `POST /auth/login` (with BUG-2 seeded)

**Files:**
- Modify: `homework-4/src/routes/auth.js`
- Modify: `homework-4/tests/auth.routes.test.js`

The login route looks the user up with a case-sensitive equality on email. That
is BUG-2. The case-insensitive test asserts the intended behaviour and will
therefore fail until the pipeline fixes it.

- [ ] **Step 1: Append the failing tests to `homework-4/tests/auth.routes.test.js`**

```js
test('POST /auth/login returns a token for valid credentials', async () => {
  const app = makeApp();
  const res = await request(app).post('/auth/login')
    .send({ email: 'alice@example.com', password: 'alice-pass' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test('POST /auth/login rejects wrong password with 401', async () => {
  const app = makeApp();
  const res = await request(app).post('/auth/login')
    .send({ email: 'alice@example.com', password: 'wrong' });
  assert.equal(res.status, 401);
});

// BUG-2: expected to be RED in the before-state. Intended behaviour is that
// login matches email case-insensitively. The seeded user 'Carol@example.com'
// must be reachable by 'carol@example.com'.
test('POST /auth/login matches email case-insensitively (BUG-2 — expected red)', async () => {
  const app = makeApp();
  const res = await request(app).post('/auth/login')
    .send({ email: 'carol@example.com', password: 'carol-pass' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});
```

- [ ] **Step 2: Run, verify the first two new tests fail**

Run: `npm test`
Expected: the three new tests fail — no `/auth/login` route yet.

- [ ] **Step 3: Add the login handler in `homework-4/src/routes/auth.js`**

Inside `createAuthRouter(db)`, after the `/register` handler and before
`return r;`, add:

```js
  r.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    // BUG-2: case-sensitive email lookup. Intended fix: lower-case both sides.
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    res.json({ token: signToken({ id: user.id, email: user.email }) });
  });
```

- [ ] **Step 4: Run, verify the expected red**

Run: `npm test`
Expected: the two happy-path login tests pass. The case-insensitive test
**fails** (it returns 401). This is the intended before-state for BUG-2.

- [ ] **Step 5: Commit**

```bash
git add homework-4/src/routes/auth.js homework-4/tests/auth.routes.test.js
git commit -m "feat(homework-4): add POST /auth/login with seeded case-sensitive bug (BUG-2)"
```

---

## Task 6: `GET /users/:id` behind auth

**Files:**
- Create: `homework-4/src/routes/users.js`
- Modify: `homework-4/src/app.js`
- Create: `homework-4/tests/users.routes.test.js`

- [ ] **Step 1: Write the failing test (`homework-4/tests/users.routes.test.js`)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';
import { signToken } from '../src/auth.js';

function tokenFor(id = 1, email = 'alice@example.com') {
  return signToken({ id, email });
}

test('GET /users/:id requires a token', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/1');
  assert.equal(res.status, 401);
});

test('GET /users/:id returns the user without the password field', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/1')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.email, 'alice@example.com');
  assert.equal(res.body.password, undefined);
});

test('GET /users/:id returns 404 for missing user', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/999')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 404);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test`
Expected: FAIL — `/users/*` routes return 404 (no router yet).

- [ ] **Step 3: Implement `homework-4/src/routes/users.js`**

```js
import { Router } from 'express';
import { requireAuth } from '../auth.js';

export function createUsersRouter(db) {
  const r = Router();
  r.use(requireAuth);

  r.get('/:id', (req, res) => {
    const row = db.prepare('SELECT id, email, name FROM users WHERE id = ?')
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });

  return r;
}
```

- [ ] **Step 4: Wire the router in `homework-4/src/app.js`**

Replace the file with:

```js
import express from 'express';
import { createAuthRouter } from './routes/auth.js';
import { createUsersRouter } from './routes/users.js';

export function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter(db));
  app.use('/users', createUsersRouter(db));
  return app;
}
```

- [ ] **Step 5: Run, verify it passes**

Run: `npm test`
Expected: 3 new user-route tests pass. BUG-2 case-insensitive test remains the
only red.

- [ ] **Step 6: Commit**

```bash
git add homework-4/src/routes/users.js homework-4/src/app.js homework-4/tests/users.routes.test.js
git commit -m "feat(homework-4): add GET /users/:id behind auth"
```

---

## Task 7: `GET /users/search` (with SEC-1 SQL injection seeded)

**Files:**
- Modify: `homework-4/src/routes/users.js`
- Modify: `homework-4/tests/users.routes.test.js`

The search endpoint concatenates `q` into the SQL on purpose. Unit tests
verify only functional behaviour (correct rows for benign input). Security
Verifier later flags the injection.

**Route order matters:** `/search` must be registered **before** `/:id` so
`/users/search` is not captured by the param route.

- [ ] **Step 1: Append the failing test to `homework-4/tests/users.routes.test.js`**

```js
test('GET /users/search?q=alice returns the Alice row', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/search?q=alice')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].email, 'alice@example.com');
});

test('GET /users/search?q=example returns multiple rows', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/search?q=example')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.length >= 5);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test`
Expected: FAIL — `/users/search` matched by `/:id` returns 404.

- [ ] **Step 3: Add the search handler to `homework-4/src/routes/users.js`**

Insert the `/search` handler **before** the existing `/:id` handler. The
updated `createUsersRouter` body looks like:

```js
  r.use(requireAuth);

  r.get('/search', (req, res) => {
    const q = String(req.query.q || '');
    // SEC-1: SQL injection via string concatenation.
    // Intended fix: parameterized LIKE with bound parameters.
    const sql = `SELECT id, email, name FROM users
                 WHERE name LIKE '%${q}%' OR email LIKE '%${q}%'`;
    const rows = db.prepare(sql).all();
    res.json(rows);
  });

  r.get('/:id', (req, res) => {
    const row = db.prepare('SELECT id, email, name FROM users WHERE id = ?')
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });
```

- [ ] **Step 4: Run, verify it passes**

Run: `npm test`
Expected: the two new search tests pass. BUG-2 remains red.

- [ ] **Step 5: Commit**

```bash
git add homework-4/src/routes/users.js homework-4/tests/users.routes.test.js
git commit -m "feat(homework-4): add GET /users/search with seeded SQL injection (SEC-1)"
```

---

## Task 8: `GET /users` paginated list (with BUG-1 seeded)

**Files:**
- Modify: `homework-4/src/routes/users.js`
- Modify: `homework-4/tests/users.routes.test.js`

Two intended logical bugs combined into BUG-1: (a) when `limit` is absent the
default of 10 is not applied (returns all rows), and (b) `offset` is off by
one. Tests assert the intended behaviour, so both fail in the before-state.

- [ ] **Step 1: Append the failing tests to `homework-4/tests/users.routes.test.js`**

```js
// BUG-1(a): expected red. Default limit of 10 should be applied when no
// limit is supplied; current code returns all 12 seeded rows.
test('GET /users applies a default limit of 10 (BUG-1 — expected red)', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 10);
});

// BUG-1(b): expected red. ?offset=2&limit=3 should return rows with ids 3,4,5;
// current code is off by one and returns 4,5,6.
test('GET /users honours offset correctly (BUG-1 — expected red)', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users?offset=2&limit=3')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map(r => r.id), [3, 4, 5]);
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npm test`
Expected: FAIL — `/users` returns 404 (no list handler yet).

- [ ] **Step 3: Add the list handler to `homework-4/src/routes/users.js`**

Insert this handler **before** `/:id` (and after `/search`). The seeded bugs
are highlighted in comments.

```js
  r.get('/', (req, res) => {
    // BUG-1(a): default limit is not applied; isNaN(limit) → -1 means
    // "no limit" in SQLite, so the endpoint returns every row.
    // Intended fix: default to 10.
    const limit = parseInt(req.query.limit, 10);
    // BUG-1(b): offset is off by one (adds 1 unconditionally).
    // Intended fix: use offset as-is.
    const offset = (parseInt(req.query.offset, 10) || 0) + 1;
    const rows = db.prepare('SELECT id, email, name FROM users ORDER BY id LIMIT ? OFFSET ?')
      .all(Number.isNaN(limit) ? -1 : limit, offset);
    res.json(rows);
  });
```

- [ ] **Step 4: Run, verify the expected reds**

Run: `npm test`
Expected: both BUG-1 tests fail (first returns 12, second returns ids 4,5,6).
This is the intended before-state.

- [ ] **Step 5: Commit**

```bash
git add homework-4/src/routes/users.js homework-4/tests/users.routes.test.js
git commit -m "feat(homework-4): add GET /users with seeded pagination bug (BUG-1)"
```

---

## Task 9: `server.js` entry point

**Files:**
- Create: `homework-4/src/server.js`

- [ ] **Step 1: Create `homework-4/src/server.js`**

```js
import { createApp } from './app.js';
import { createDb } from './db.js';

const db = createDb(process.env.DB_PATH || 'data.sqlite');
const app = createApp(db);
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`homework-4 sample app listening on http://localhost:${port}`);
});
```

- [ ] **Step 2: Smoke-test it**

Run (from `homework-4/`): `npm start &` then `curl -s -X POST http://localhost:3000/auth/login -H 'content-type: application/json' -d '{"email":"alice@example.com","password":"alice-pass"}'`
Expected: JSON `{ "token": "..." }`.

Then stop the server: `kill %1` (or Ctrl-C if foreground).

Clean up the created file: `rm -f data.sqlite` (it is gitignored, but no need to leave it around).

- [ ] **Step 3: Commit**

```bash
git add homework-4/src/server.js
git commit -m "feat(homework-4): add server entry point"
```

---

## Task 10: Bug context docs for the pipeline

**Files:**
- Create: `homework-4/context/bugs/BUG-1/bug-context.md`
- Create: `homework-4/context/bugs/BUG-2/bug-context.md`
- Create: `homework-4/context/bugs/SEC-1/bug-context.md`
- Create: `homework-4/context/bugs/SEC-2/bug-context.md`

Each file is a short, factual description of the defect — the Bug Researcher
agent uses it as its starting point.

- [ ] **Step 1: Create `homework-4/context/bugs/BUG-1/bug-context.md`**

```markdown
# BUG-1 — `GET /users` pagination

**Symptom:** `GET /users` returns the wrong window of rows.

- When the `limit` query param is missing, the endpoint returns every row
  instead of the expected default of 10.
- When `offset` is supplied, results are shifted by one.

**Location:** `src/routes/users.js`, the `/` handler.

**Failing tests:**
- `tests/users.routes.test.js` → "GET /users applies a default limit of 10"
- `tests/users.routes.test.js` → "GET /users honours offset correctly"

**Expected behaviour:** default `limit` is 10; `offset` is applied verbatim.
```

- [ ] **Step 2: Create `homework-4/context/bugs/BUG-2/bug-context.md`**

```markdown
# BUG-2 — `POST /auth/login` case-sensitive email

**Symptom:** A user registered with `Carol@example.com` cannot log in using
`carol@example.com` — the lookup compares email case-sensitively.

**Location:** `src/routes/auth.js`, the `/login` handler.

**Failing test:**
- `tests/auth.routes.test.js` → "POST /auth/login matches email case-insensitively"

**Expected behaviour:** email is normalized (lower-cased) on both registration
and login before comparison.
```

- [ ] **Step 3: Create `homework-4/context/bugs/SEC-1/bug-context.md`**

```markdown
# SEC-1 — SQL injection in `GET /users/search`

**Vulnerability:** the `q` query parameter is concatenated directly into the
SQL string, allowing an attacker to inject arbitrary SQL.

**Proof:** `GET /users/search?q=%27%20OR%201=1--` returns every row.

**Location:** `src/routes/users.js`, the `/search` handler.

**Expected fix:** use parameterized `LIKE` with bound parameters
(`db.prepare('… LIKE ?').all('%' + q + '%')`).

**Detected by:** Security Verifier agent (no failing unit test on its own).
```

- [ ] **Step 4: Create `homework-4/context/bugs/SEC-2/bug-context.md`**

```markdown
# SEC-2 — hardcoded auth secret and plaintext passwords

**Vulnerabilities:**

1. The HMAC token secret is a hardcoded string literal in source
   (`src/auth.js`).
2. Passwords are stored and compared in plaintext (`hashPassword` is the
   identity function; `verifyPassword` is `===`).

**Location:** `src/auth.js`.

**Expected fix:**
- Read the secret from `process.env.AUTH_SECRET` (fail fast if missing).
- Hash passwords with `crypto.scrypt` (random salt per user) and compare with
  `crypto.timingSafeEqual`.

**Detected by:** Security Verifier agent.
```

- [ ] **Step 5: Commit**

```bash
git add homework-4/context/bugs/
git commit -m "docs(homework-4): seed bug-context files for the four defects"
```

---

## Final verification

- [ ] **Step 1: Run the full test suite from `homework-4/`**

Run: `npm test`
Expected before-state:
- ✅ all `db.test.js` tests pass
- ✅ all `auth.helpers.test.js` tests pass
- ✅ register tests, login happy-path & wrong-password tests pass
- ❌ "POST /auth/login matches email case-insensitively (BUG-2 — expected red)" — FAIL
- ✅ `/users/:id` tests pass
- ✅ `/users/search` tests pass
- ❌ "GET /users applies a default limit of 10 (BUG-1 — expected red)" — FAIL
- ❌ "GET /users honours offset correctly (BUG-1 — expected red)" — FAIL

Total: 3 expected red tests; everything else green. This is the documented
before-state the pipeline will turn fully green.

- [ ] **Step 2: Confirm the app starts**

Run: `npm start`
Expected: prints `homework-4 sample app listening on http://localhost:3000`,
no errors. Stop with Ctrl-C and `rm -f homework-4/data.sqlite`.
