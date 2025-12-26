import db from '../db.js';

export function authenticateUser(req, res, next) {
  const sessionId = req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }

  const session = db.prepare(`
    SELECT s.*, u.username
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, Date.now());

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = {
    id: session.user_id,
    username: session.username
  };

  next();
}
