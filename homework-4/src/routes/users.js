import { Router } from 'express';
import { requireAuth } from '../auth.js';

export function createUsersRouter(db) {
  const r = Router();
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

  r.get('/', (req, res) => {
    // BUG-1(a): default limit is not applied; isNaN(limit) → -1 means
    // "no limit" in SQLite, so the endpoint returns every row.
    // Intended fix: default to 10.
    const limit = parseInt(req.query.limit, 10) || 10;
    // BUG-1(b): offset is off by one (adds 1 unconditionally).
    // Intended fix: use offset as-is.
    const offset = parseInt(req.query.offset, 10) || 0;
    const rows = db.prepare('SELECT id, email, name FROM users ORDER BY id LIMIT ? OFFSET ?')
      .all(limit, offset);
    res.json(rows);
  });

  r.get('/:id', (req, res) => {
    const row = db.prepare('SELECT id, email, name FROM users WHERE id = ?')
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });

  return r;
}
