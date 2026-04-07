import { Router } from 'express';
import { randomUUID } from 'crypto';

export default function tasksRouter(db) {
  const router = Router();

  // GET /tracker/api/tasks/all  — admin: all users' active tasks
  router.get('/all', (_req, res) => {
    res.json(
      db.prepare(`
        SELECT t.*, u.name AS user_name
        FROM tasks t
        JOIN users u ON t.user_id = u.id
        WHERE t.status = 'active'
        ORDER BY t.user_id, t.created_at
      `).all()
    );
  });

  // GET /tracker/api/tasks?user_id=
  router.get('/', (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    res.json(
      db.prepare(
        `SELECT * FROM tasks WHERE user_id = ? AND status = 'active' ORDER BY created_at`
      ).all(user_id)
    );
  });

  // POST /tracker/api/tasks
  router.post('/', (req, res) => {
    const {
      user_id, title, description, type,
      due_date, frequency_count, frequency_period,
      target_minutes, time_period, created_by,
    } = req.body;
    if (!user_id || !title || !type) {
      return res.status(400).json({ error: 'user_id, title, type required' });
    }
    const id = randomUUID();
    db.prepare(`
      INSERT INTO tasks
        (id, user_id, title, description, type, due_date,
         frequency_count, frequency_period, target_minutes, time_period, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, user_id, title, description ?? null, type,
      due_date ?? null, frequency_count ?? null, frequency_period ?? null,
      target_minutes ?? null, time_period ?? null, created_by ?? null
    );
    res.status(201).json({ id });
  });

  // PATCH /tracker/api/tasks/:id
  router.patch('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const {
      title, description, due_date,
      frequency_count, frequency_period,
      target_minutes, time_period,
    } = req.body;
    db.prepare(`
      UPDATE tasks SET
        title            = ?,
        description      = ?,
        due_date         = ?,
        frequency_count  = ?,
        frequency_period = ?,
        target_minutes   = ?,
        time_period      = ?
      WHERE id = ?
    `).run(
      title            ?? row.title,
      description      ?? row.description,
      due_date         ?? row.due_date,
      frequency_count  ?? row.frequency_count,
      frequency_period ?? row.frequency_period,
      target_minutes   ?? row.target_minutes,
      time_period      ?? row.time_period,
      req.params.id
    );
    res.json({ ok: true });
  });

  // DELETE /tracker/api/tasks/:id  — archive
  router.delete('/:id', (req, res) => {
    db.prepare(`UPDATE tasks SET status = 'archived' WHERE id = ?`).run(req.params.id);
    res.status(204).end();
  });

  return router;
}
