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
