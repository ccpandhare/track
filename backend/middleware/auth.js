import db from '../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load allowlist for session validation
function loadAllowlist() {
  try {
    const allowlistPath = join(__dirname, '../allowlist.json');
    const data = readFileSync(allowlistPath, 'utf8');
    const allowlist = JSON.parse(data);
    return new Set(allowlist.allowedUsers || []);
  } catch (error) {
    console.warn('Warning: Could not load allowlist.json in auth middleware');
    return new Set();
  }
}

let allowedUsers = loadAllowlist();

// Export function to reload allowlist (for hot-reload)
export function reloadAllowlist() {
  allowedUsers = loadAllowlist();
  console.log('[SECURITY] Allowlist reloaded in auth middleware');
}

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

  // SECURITY: Check if user is still in allowlist
  if (!allowedUsers.has(session.username)) {
    console.log(`[SECURITY] Session invalidated for removed user: ${session.username}`);
    // Delete the session from database
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return res.status(403).json({ error: 'Access revoked. Your account has been deactivated.' });
  }

  req.user = {
    id: session.user_id,
    username: session.username
  };

  next();
}
