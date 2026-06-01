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
