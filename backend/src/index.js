import express from 'express';
import { initDb } from './db.js';
import sessionsRouter from './routes/sessions.js';
import lessonsRouter from './routes/lessons.js';
import summaryRouter from './routes/summary.js';

const app = express();
app.use(express.json());

const db = initDb();

app.use('/tracker/api/sessions', sessionsRouter(db));
app.use('/tracker/api/lessons', lessonsRouter(db));
app.use('/tracker/api/summary', summaryRouter(db));

app.get('/tracker/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`tracker-api listening on :${PORT}`));
