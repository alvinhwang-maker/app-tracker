import { Router } from 'express';

export default function usersRouter(db) {
  const router = Router();

  // GET /tracker/api/users
  router.get('/', (_req, res) => {
    res.json(db.prepare('SELECT * FROM users ORDER BY id').all());
  });

  return router;
}
