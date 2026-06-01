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
