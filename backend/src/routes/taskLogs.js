import { Router } from 'express';
import { randomUUID } from 'crypto';

export default function taskLogsRouter(db) {
  const router = Router();

  // GET /tracker/api/task-logs?user_id=&from=&to=&task_id=
  router.get('/', (req, res) => {
    const { user_id, from, to, task_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    let q = 'SELECT * FROM task_logs WHERE user_id = ?';
    const p = [user_id];
    if (task_id) { q += ' AND task_id = ?'; p.push(task_id); }
    if (from)    { q += ' AND date >= ?';   p.push(from); }
    if (to)      { q += ' AND date <= ?';   p.push(to); }
    q += ' ORDER BY date DESC, created_at DESC';

    res.json(db.prepare(q).all(...p));
  });

  // POST /tracker/api/task-logs
  router.post('/', (req, res) => {
    const { task_id, user_id, date, duration_minutes, note } = req.body;
    if (!task_id || !user_id || !date) {
      return res.status(400).json({ error: 'task_id, user_id, date required' });
    }
    const id = randomUUID();
    db.prepare(
      'INSERT INTO task_logs (id, task_id, user_id, date, duration_minutes, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, task_id, user_id, date, duration_minutes ?? 0, note ?? null);
    res.status(201).json({ id });
  });

  // DELETE /tracker/api/task-logs/:id
  router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM task_logs WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
