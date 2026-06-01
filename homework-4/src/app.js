import express from 'express';
import { createAuthRouter } from './routes/auth.js';

export function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter(db));
  return app;
}
