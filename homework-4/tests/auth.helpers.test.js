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
