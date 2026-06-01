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
