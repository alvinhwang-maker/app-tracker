import { Router } from 'express';

export default function lessonsRouter(db) {
  const router = Router();

  // GET /tracker/api/lessons/:subject
  router.get('/:subject', (req, res) => {
    res.json(
      db.prepare(
        'SELECT * FROM lessons WHERE subject = ? ORDER BY lesson_number'
      ).all(req.params.subject)
    );
  });

  // PATCH /tracker/api/lessons/:subject/:number  — toggle complete / incomplete
  router.patch('/:subject/:number', (req, res) => {
    const { subject, number } = req.params;
    const row = db.prepare(
      'SELECT completed FROM lessons WHERE subject = ? AND lesson_number = ?'
    ).get(subject, number);
    if (!row) return res.status(404).json({ error: 'Lesson not found' });

    const newCompleted = row.completed ? 0 : 1;
    db.prepare(
      'UPDATE lessons SET completed = ?, completed_at = ? WHERE subject = ? AND lesson_number = ?'
    ).run(newCompleted, newCompleted ? new Date().toISOString() : null, subject, number);

    res.json({ completed: newCompleted === 1 });
  });

  return router;
}
