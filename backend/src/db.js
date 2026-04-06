import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/tracker.db');

export function initDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id               TEXT PRIMARY KEY,
      date             TEXT NOT NULL,
      subject          TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 0,
      gym_type         TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lessons (
      subject        TEXT NOT NULL,
      lesson_number  INTEGER NOT NULL,
      completed      INTEGER DEFAULT 0,
      completed_at   TEXT,
      PRIMARY KEY (subject, lesson_number)
    );
  `);

  // Seed lessons on first run
  const { c } = db.prepare('SELECT COUNT(*) as c FROM lessons').get();
  if (c === 0) {
    const insert = db.prepare('INSERT INTO lessons (subject, lesson_number) VALUES (?, ?)');
    db.transaction(() => {
      for (let i = 1; i <= 54; i++) insert.run('french', i);
      for (let i = 1; i <= 25; i++) insert.run('japanese', i);
    })();
    console.log('Seeded 54 French + 25 Japanese lessons.');
  }

  return db;
}
