import { Router } from 'express';

export default function summaryRouter(db) {
  const router = Router();

  // GET /tracker/api/summary
  router.get('/', (_req, res) => {
    const timeTotals = db.prepare(`
      SELECT subject, SUM(duration_minutes) as total_minutes
      FROM sessions
      GROUP BY subject
    `).all();

    const lessonCounts = db.prepare(`
      SELECT subject, COUNT(*) as completed
      FROM lessons
      WHERE completed = 1
      GROUP BY subject
    `).all();

    const gymVisits = db.prepare(
      `SELECT COUNT(*) as total FROM sessions WHERE subject = 'gym'`
    ).get().total;

    // Consecutive gym days streak (ending today or yesterday)
    const gymDates = db.prepare(
      `SELECT DISTINCT date FROM sessions WHERE subject = 'gym' ORDER BY date DESC`
    ).all().map(r => r.date);

    let gymStreak = 0;
    if (gymDates.length) {
      const today = new Date().toISOString().slice(0, 10);
      // Allow streak to count if last session was today or yesterday
      let cursor = new Date(gymDates[0] <= today ? gymDates[0] : today);
      for (const d of gymDates) {
        const expected = new Date(cursor);
        expected.setDate(expected.getDate() - gymStreak);
        if (d === expected.toISOString().slice(0, 10)) gymStreak++;
        else break;
      }
    }

    res.json({ timeTotals, lessonCounts, gymVisits, gymStreak });
  });

  return router;
}
