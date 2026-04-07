import { Router } from 'express';

export default function summaryRouter(db) {
  const router = Router();

  // GET /tracker/api/summary?user_id=
  router.get('/', (req, res) => {
    const { user_id = 'alvin' } = req.query;

    const timeTotals = db.prepare(`
      SELECT subject, SUM(duration_minutes) AS total_minutes
      FROM sessions
      WHERE user_id = ? AND deleted = 0
      GROUP BY subject
    `).all(user_id);

    const lessonCounts = db.prepare(`
      SELECT subject, COUNT(*) AS completed
      FROM lessons
      WHERE completed = 1
      GROUP BY subject
    `).all();

    const gymVisits = db.prepare(
      `SELECT COUNT(*) AS total FROM sessions WHERE subject = 'gym' AND user_id = ? AND deleted = 0`
    ).get(user_id).total;

    // Consecutive gym-day streak
    const gymDates = db.prepare(`
      SELECT DISTINCT date FROM sessions
      WHERE subject = 'gym' AND user_id = ? AND deleted = 0
      ORDER BY date DESC
    `).all(user_id).map(r => r.date);

    let gymStreak = 0;
    if (gymDates.length) {
      const todayStr = new Date().toISOString().slice(0, 10);
      // Allow streak if last session is today or yesterday
      const mostRecent = gymDates[0];
      const diff = Math.round(
        (new Date(todayStr) - new Date(mostRecent)) / 86400000
      );
      if (diff <= 1) {
        let expected = new Date(mostRecent);
        for (const d of gymDates) {
          if (d === expected.toISOString().slice(0, 10)) {
            gymStreak++;
            expected.setDate(expected.getDate() - 1);
          } else break;
        }
      }
    }

    res.json({ timeTotals, lessonCounts, gymVisits, gymStreak });
  });

  return router;
}
