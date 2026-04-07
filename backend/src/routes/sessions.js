import { Router } from 'express';
import { randomUUID } from 'crypto';

export default function sessionsRouter(db) {
  const router = Router();

  const today = () => new Date().toISOString().slice(0, 10);

  // GET /tracker/api/sessions/flagged  — admin: all unreviewed retroactive entries
  router.get('/flagged', (_req, res) => {
    const rows = db.prepare(`
      SELECT s.*, u.name AS user_name
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE (
        DATE(s.created_at) != s.date
        OR s.updated_at IS NOT NULL
        OR s.deleted = 1
      )
      AND s.admin_reviewed = 0
      ORDER BY s.created_at DESC
    `).all();
    res.json(rows);
  });

  // GET /tracker/api/sessions?date=&user_id=  OR  ?from=&to=&user_id=
  router.get('/', (req, res) => {
    const { date, from, to, user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    if (date) {
      return res.json(
        db.prepare(
          'SELECT * FROM sessions WHERE date = ? AND user_id = ? AND deleted = 0 ORDER BY created_at'
        ).all(date, user_id)
      );
    }
    if (from && to) {
      return res.json(
        db.prepare(
          'SELECT * FROM sessions WHERE date >= ? AND date <= ? AND user_id = ? AND deleted = 0 ORDER BY date, created_at'
        ).all(from, to, user_id)
      );
    }
    res.status(400).json({ error: 'Provide date or from+to query params' });
  });

  // POST /tracker/api/sessions
  router.post('/', (req, res) => {
    const { date, subject, duration_minutes, gym_type, user_id } = req.body;
    if (!date || !subject || !user_id) {
      return res.status(400).json({ error: 'date, subject, user_id required' });
    }
    const id = randomUUID();
    db.prepare(
      'INSERT INTO sessions (id, date, subject, duration_minutes, gym_type, user_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, date, subject, duration_minutes ?? 0, gym_type ?? null, user_id);
    res.status(201).json({ id });
  });

  // PATCH /tracker/api/sessions/:id  — edit with before/after stored
  router.patch('/:id', (req, res) => {
    if (req.params.id === 'flagged') return res.status(404).end(); // guard for route conflict
    const { duration_minutes, gym_type } = req.body;
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });

    // Preserve original values only on the first edit
    const orig_duration = row.original_duration_minutes ?? row.duration_minutes;
    const orig_gym_type = row.original_gym_type       ?? row.gym_type;

    db.prepare(`
      UPDATE sessions SET
        duration_minutes          = ?,
        gym_type                  = ?,
        updated_at                = datetime('now'),
        original_duration_minutes = ?,
        original_gym_type         = ?,
        admin_reviewed            = 0,
        admin_reviewed_at         = NULL
      WHERE id = ?
    `).run(
      duration_minutes ?? row.duration_minutes,
      gym_type         ?? row.gym_type,
      orig_duration,
      orig_gym_type,
      req.params.id
    );
    res.json({ ok: true });
  });

  // DELETE /tracker/api/sessions/:id
  // Same-day → hard delete (no audit trail needed)
  // Past date → soft delete (visible to admin)
  router.delete('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });

    if (row.date === today()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
    } else {
      db.prepare(`
        UPDATE sessions SET
          deleted           = 1,
          deleted_at        = datetime('now'),
          admin_reviewed    = 0,
          admin_reviewed_at = NULL
        WHERE id = ?
      `).run(req.params.id);
    }
    res.status(204).end();
  });

  // PATCH /tracker/api/sessions/:id/review  — admin dismisses a flag
  router.patch('/:id/review', (req, res) => {
    db.prepare(`
      UPDATE sessions SET admin_reviewed = 1, admin_reviewed_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
