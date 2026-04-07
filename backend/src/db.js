import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/tracker.db');

function safeAlter(db, sql) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

export function initDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id    TEXT PRIMARY KEY,
      name  TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role  TEXT DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id                        TEXT PRIMARY KEY,
      date                      TEXT NOT NULL,
      subject                   TEXT NOT NULL,
      duration_minutes          INTEGER DEFAULT 0,
      gym_type                  TEXT,
      user_id                   TEXT DEFAULT 'alvin',
      created_at                TEXT DEFAULT (datetime('now')),
      updated_at                TEXT,
      original_duration_minutes INTEGER,
      original_gym_type         TEXT,
      deleted                   INTEGER DEFAULT 0,
      deleted_at                TEXT,
      admin_reviewed            INTEGER DEFAULT 0,
      admin_reviewed_at         TEXT
    );

    CREATE TABLE IF NOT EXISTS lessons (
      subject       TEXT NOT NULL,
      lesson_number INTEGER NOT NULL,
      completed     INTEGER DEFAULT 0,
      completed_at  TEXT,
      PRIMARY KEY (subject, lesson_number)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      title            TEXT NOT NULL,
      description      TEXT,
      type             TEXT NOT NULL,
      due_date         TEXT,
      frequency_count  INTEGER,
      frequency_period TEXT,
      target_minutes   INTEGER,
      time_period      TEXT,
      status           TEXT DEFAULT 'active',
      created_by       TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_logs (
      id               TEXT PRIMARY KEY,
      task_id          TEXT NOT NULL,
      user_id          TEXT NOT NULL,
      date             TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 0,
      note             TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate existing sessions table — safe no-ops if columns already exist
  safeAlter(db, "ALTER TABLE sessions ADD COLUMN user_id TEXT DEFAULT 'alvin'");
  safeAlter(db, 'ALTER TABLE sessions ADD COLUMN updated_at TEXT');
  safeAlter(db, 'ALTER TABLE sessions ADD COLUMN original_duration_minutes INTEGER');
  safeAlter(db, 'ALTER TABLE sessions ADD COLUMN original_gym_type TEXT');
  safeAlter(db, 'ALTER TABLE sessions ADD COLUMN deleted INTEGER DEFAULT 0');
  safeAlter(db, 'ALTER TABLE sessions ADD COLUMN deleted_at TEXT');
  safeAlter(db, 'ALTER TABLE sessions ADD COLUMN admin_reviewed INTEGER DEFAULT 0');
  safeAlter(db, 'ALTER TABLE sessions ADD COLUMN admin_reviewed_at TEXT');

  // Seed users
  if (db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0) {
    const ins = db.prepare('INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)');
    db.transaction(() => {
      ins.run('alvin',  'Alvin',  'alvin.hwang@gmail.com',    'admin');
      ins.run('adrian', 'Adrian', 'adrianh79367@gmail.com',   'user');
      ins.run('hailey', 'Hailey', 'haileyh79367@gmail.com',   'user');
    })();
    console.log('Seeded 3 users.');
  }

  // Seed lessons — skip if already seeded
  if (db.prepare('SELECT COUNT(*) as c FROM lessons').get().c === 0) {
    const ins = db.prepare('INSERT OR IGNORE INTO lessons (subject, lesson_number) VALUES (?, ?)');
    db.transaction(() => {
      for (let i = 1; i <= 54; i++) ins.run('french',   i);
      for (let i = 1; i <= 25; i++) ins.run('japanese', i);
    })();
    console.log('Seeded 54 French + 25 Japanese lessons.');
  }

  return db;
}
