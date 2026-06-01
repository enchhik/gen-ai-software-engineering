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
