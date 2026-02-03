/**
 * Central Auth Integration for track.chinmaypandhare.uk
 *
 * This middleware verifies sessions against the central auth service at
 * auth.chinmaypandhare.uk instead of managing local sessions.
 *
 * The central auth uses a shared cookie (ccp_auth_token) on .chinmaypandhare.uk domain.
 */

const CENTRAL_AUTH_URL = process.env.CENTRAL_AUTH_URL || 'https://auth.chinmaypandhare.uk';
const SERVICE_NAME = 'track';

// Cache for auth verification to reduce load on central auth
// Cache entries expire after 60 seconds
const authCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function getCachedAuth(sessionId) {
  const cached = authCache.get(sessionId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }
  authCache.delete(sessionId);
  return null;
}

function setCachedAuth(sessionId, result) {
  authCache.set(sessionId, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

// Cleanup expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of authCache.entries()) {
    if (now >= value.expiresAt) {
      authCache.delete(key);
    }
  }
}, CACHE_TTL_MS);

// No-op for backward compatibility with server.js hot-reload
export function reloadAllowlist() {
  console.log('[AUTH] Allowlist reload called (no-op with central auth)');
}

export async function authenticateUser(req, res, next) {
  // Get session from cookie (set by central auth on .chinmaypandhare.uk domain)
  const sessionId = req.cookies?.ccp_auth_token;

  // Also support X-Session-Id header for backward compatibility during migration
  const headerSessionId = req.headers['x-session-id'];

  if (!sessionId && !headerSessionId) {
    return res.status(401).json({
      error: 'Not authenticated',
      redirect: `${CENTRAL_AUTH_URL}/login?service=${SERVICE_NAME}&redirect=${encodeURIComponent(req.protocol + '://' + req.get('host'))}`
    });
  }

  // Prefer cookie over header
  const authToken = sessionId || headerSessionId;

  // Check cache first
  const cached = getCachedAuth(authToken);
  if (cached) {
    if (cached.valid) {
      req.user = { username: cached.username };
      return next();
    } else {
      return res.status(401).json({
        error: cached.reason === 'no_access' ? 'Access denied to track service' : 'Invalid session',
        redirect: `${CENTRAL_AUTH_URL}/login?service=${SERVICE_NAME}&redirect=${encodeURIComponent(req.protocol + '://' + req.get('host'))}`
      });
    }
  }

  try {
    // Verify session with central auth
    const response = await fetch(`${CENTRAL_AUTH_URL}/api/verify?service=${SERVICE_NAME}`, {
      method: 'GET',
      headers: {
        'Cookie': `ccp_auth_token=${authToken}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      console.error(`[AUTH] Central auth returned ${response.status}`);
      return res.status(401).json({
        error: 'Authentication service unavailable',
        redirect: `${CENTRAL_AUTH_URL}/login?service=${SERVICE_NAME}&redirect=${encodeURIComponent(req.protocol + '://' + req.get('host'))}`
      });
    }

    const result = await response.json();

    // Cache the result
    setCachedAuth(authToken, result);

    if (!result.valid) {
      console.log(`[AUTH] Session invalid: ${result.reason}, username: ${result.username || 'unknown'}`);
      return res.status(401).json({
        error: result.reason === 'no_access' ? 'Access denied to track service' : 'Invalid session',
        redirect: `${CENTRAL_AUTH_URL}/login?service=${SERVICE_NAME}&redirect=${encodeURIComponent(req.protocol + '://' + req.get('host'))}`
      });
    }

    // Set user info on request
    req.user = {
      username: result.username,
      isAdmin: result.isAdmin || false
    };

    next();
  } catch (error) {
    console.error('[AUTH] Error verifying session with central auth:', error.message);
    return res.status(500).json({
      error: 'Authentication service error',
      redirect: `${CENTRAL_AUTH_URL}/login?service=${SERVICE_NAME}&redirect=${encodeURIComponent(req.protocol + '://' + req.get('host'))}`
    });
  }
}
