import Database from 'better-sqlite3';

const SEED = [
  ['alice@example.com',   'Alice',    'alice-pass'],
  ['bob@example.com',     'Bob',      'bob-pass'],
  ['Carol@example.com',   'Carol',    'carol-pass'],
  ['dave@example.com',    'Dave',     'dave-pass'],
  ['eve@example.com',     'Eve',      'eve-pass'],
  ['frank@example.com',   'Frank',    'frank-pass'],
  ['grace@example.com',   'Grace',    'grace-pass'],
  ['heidi@example.com',   'Heidi',    'heidi-pass'],
  ['ivan@example.com',    'Ivan',     'ivan-pass'],
  ['judy@example.com',    'Judy',     'judy-pass'],
  ['mallory@example.com', 'Mallory',  'mallory-pass'],
  ['oscar@example.com',   'Oscar',    'oscar-pass'],
];

export function createDb(path = ':memory:') {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL
    );
  `);
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO users (email, name, password) VALUES (?, ?, ?)');
    const tx = db.transaction((rows) => { for (const r of rows) insert.run(...r); });
    tx(SEED);
  }
  return db;
}
