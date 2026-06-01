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
