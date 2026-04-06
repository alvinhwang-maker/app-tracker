import { Router } from 'express';
import { randomUUID } from 'crypto';

export default function sessionsRouter(db) {
  const router = Router();

  // GET /tracker/api/sessions?date=YYYY-MM-DD  OR  ?from=YYYY-MM-DD&to=YYYY-MM-DD
  router.get('/', (req, res) => {
    const { date, from, to } = req.query;
    if (date) {
      const rows = db.prepare(
        'SELECT * FROM sessions WHERE date = ? ORDER BY created_at'
      ).all(date);
      return res.json(rows);
    }
    if (from && to) {
      const rows = db.prepare(
        'SELECT * FROM sessions WHERE date >= ? AND date <= ? ORDER BY date, created_at'
      ).all(from, to);
      return res.json(rows);
    }
    res.status(400).json({ error: 'Provide date or from+to query params' });
  });

  // POST /tracker/api/sessions
  router.post('/', (req, res) => {
    const { date, subject, duration_minutes, gym_type } = req.body;
    if (!date || !subject) {
      return res.status(400).json({ error: 'date and subject are required' });
    }
    const id = randomUUID();
    db.prepare(
      'INSERT INTO sessions (id, date, subject, duration_minutes, gym_type) VALUES (?, ?, ?, ?, ?)'
    ).run(id, date, subject, duration_minutes ?? 0, gym_type ?? null);
    res.status(201).json({ id });
  });

  // DELETE /tracker/api/sessions/:id
  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
