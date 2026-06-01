import { createApp } from './app.js';
import { createDb } from './db.js';

const db = createDb(process.env.DB_PATH || 'data.sqlite');
const app = createApp(db);
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`homework-4 sample app listening on http://localhost:${port}`);
});
