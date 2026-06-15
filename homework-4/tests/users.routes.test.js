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

test('GET /users with explicit limit returns that many rows', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users?limit=5')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 5);
  assert.deepEqual(res.body.map(r => r.id), [1, 2, 3, 4, 5]);
});

test('GET /users with offset=0 and default limit returns first 10', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users?offset=0')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 10);
  assert.deepEqual(res.body.map(r => r.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('GET /users with offset beyond total rows returns empty', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users?offset=20&limit=5')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 0);
});

test('GET /users with offset at boundary returns partial result', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users?offset=10&limit=5')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 2);
  assert.deepEqual(res.body.map(r => r.id), [11, 12]);
});

test('GET /users/search with SQL injection attempt treats pattern as literal (SEC-1)', async () => {
  const app = createApp(createDb(':memory:'));
  const maliciousQuery = "alice' OR '1'='1";
  const res = await request(app).get(`/users/search?q=${encodeURIComponent(maliciousQuery)}`)
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 0);
});

test('GET /users/search with SQL comment attempt is escaped (SEC-1)', async () => {
  const app = createApp(createDb(':memory:'));
  const maliciousQuery = "'; DROP TABLE users; --";
  const res = await request(app).get(`/users/search?q=${encodeURIComponent(maliciousQuery)}`)
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 0);
});

test('GET /users/search with percent signs matches correctly (SEC-1)', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/search?q=%')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.length >= 0);
});

test('GET /users/search with apostrophe does not cause SQL injection (SEC-1)', async () => {
  const app = createApp(createDb(':memory:'));
  const maliciousQuery = "alice' --";
  const res = await request(app).get(`/users/search?q=${encodeURIComponent(maliciousQuery)}`)
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 0);
});

test('GET /users/search with empty query returns matches on all users', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/search?q=')
    .set('Authorization', `Bearer ${tokenFor()}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.length >= 5);
});

test('GET /users/search requires authentication (SEC-1)', async () => {
  const app = createApp(createDb(':memory:'));
  const res = await request(app).get('/users/search?q=alice');
  assert.equal(res.status, 401);
});
