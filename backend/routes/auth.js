import express from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../db.js';
import { auditLog, AuditEvents } from '../utils/audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const authRouter = express.Router();

const rpName = 'Flight Tracker';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || 'http://localhost:5173';

console.log('[CONFIG] RP_ID:', rpID);
console.log('[CONFIG] ORIGIN:', origin);

// Store challenges temporarily (in production, use Redis)
const challenges = new Map();

// Load allowlist
function loadAllowlist() {
  try {
    const allowlistPath = join(__dirname, '../allowlist.json');
    const data = readFileSync(allowlistPath, 'utf8');
    const allowlist = JSON.parse(data);
    return new Set(allowlist.allowedUsers || []);
  } catch (error) {
    console.warn('Warning: Could not load allowlist.json. Registration will be disabled.');
    return new Set();
  }
}

let allowedUsers = loadAllowlist();

// Export function to reload allowlist (for hot-reload)
export function reloadAllowlist() {
  allowedUsers = loadAllowlist();
  console.log('[SECURITY] Allowlist reloaded in auth routes');
  return allowedUsers.size;
}

// Registration start
authRouter.post('/register/start', async (req, res) => {
  const { username, inviteCode } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  if (!inviteCode) {
    return res.status(400).json({ error: 'Invite code required' });
  }

  // Verify invite code first (to provide better error messages)
  const invite = db.prepare(`
    SELECT code, username, used_at
    FROM invite_codes
    WHERE code = ?
  `).get(inviteCode);

  if (!invite) {
    auditLog(AuditEvents.REGISTRATION_BLOCKED, username, false, { reason: 'invalid_invite_code' });
    return res.status(403).json({ error: 'Invalid invite code. Please check your code and try again.' });
  }

  if (invite.used_at) {
    auditLog(AuditEvents.REGISTRATION_BLOCKED, username, false, { reason: 'invite_code_already_used' });
    return res.status(403).json({ error: 'This invite code has already been used. Please contact the administrator for a new code.' });
  }

  // Check if the username matches the invite code
  if (invite.username !== username) {
    auditLog(AuditEvents.REGISTRATION_BLOCKED, username, false, { reason: 'invite_code_username_mismatch' });
    return res.status(403).json({
      error: `This invite code is for username "${invite.username}". Please use the correct username or contact the administrator.`
    });
  }

  // Check if username is in allowlist (should be added automatically when invite is generated)
  if (!allowedUsers.has(username)) {
    auditLog(AuditEvents.REGISTRATION_BLOCKED, username, false, { reason: 'not_in_allowlist' });
    return res.status(403).json({
      error: 'Your account has not been authorized yet. Please contact the administrator to complete your invitation.'
    });
  }

  auditLog(AuditEvents.REGISTRATION_ATTEMPT, username, true, { invite_code: inviteCode });

  // Check if user exists
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const userId = crypto.randomUUID();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from(userId.replace(/-/g, ''), 'hex')),
    userName: username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  challenges.set(userId, options.challenge);

  res.json({ options, userId });
});

// Registration finish
authRouter.post('/register/finish', async (req, res) => {
  const { userId, username, credential, inviteCode } = req.body;

  const expectedChallenge = challenges.get(userId);
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'Invalid challenge' });
  }

  // Re-verify invite code hasn't been used in between
  const invite = db.prepare('SELECT used_at FROM invite_codes WHERE code = ?').get(inviteCode);
  if (!invite || invite.used_at) {
    return res.status(403).json({ error: 'Invite code is no longer valid' });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // Store user
    db.prepare('INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)').run(
      userId,
      username,
      Date.now()
    );

    // Store authenticator
    db.prepare(`
      INSERT INTO authenticators (
        id, user_id, credential_id, credential_public_key, counter,
        credential_device_type, credential_backed_up, transports, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      userId,
      Buffer.from(credentialID).toString('base64'),
      credentialPublicKey,
      counter,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      JSON.stringify(credential.response.transports || []),
      Date.now()
    );

    // Mark invite code as used
    db.prepare(`
      UPDATE invite_codes
      SET used_at = ?, used_by_user_id = ?
      WHERE code = ?
    `).run(Date.now(), userId, inviteCode);

    challenges.delete(userId);

    auditLog(AuditEvents.REGISTRATION_SUCCESS, username, true, { invite_code: inviteCode });
    res.json({ verified: true });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Authentication start
authRouter.post('/login/start', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  // SECURITY: Check if username is still in allowlist
  if (!allowedUsers.has(username)) {
    auditLog(AuditEvents.LOGIN_BLOCKED, username, false, { reason: 'not_in_allowlist' });
    return res.status(403).json({ error: 'Access denied. Account not authorized.' });
  }

  auditLog(AuditEvents.LOGIN_ATTEMPT, username, true);

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  const authenticators = db.prepare(`
    SELECT credential_id, transports
    FROM authenticators
    WHERE user_id = ?
  `).all(user.id);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: authenticators.map(auth => ({
      id: Buffer.from(auth.credential_id, 'base64'),
      type: 'public-key',
      transports: JSON.parse(auth.transports),
    })),
    userVerification: 'preferred',
  });

  challenges.set(user.id, options.challenge);

  res.json({ options, userId: user.id });
});

// Authentication finish
authRouter.post('/login/finish', async (req, res) => {
  const { userId, credential } = req.body;

  const expectedChallenge = challenges.get(userId);
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'Invalid challenge' });
  }

  try {
    const credentialIdBase64 = Buffer.from(credential.rawId, 'base64').toString('base64');

    const authenticator = db.prepare(`
      SELECT * FROM authenticators WHERE user_id = ? AND credential_id = ?
    `).get(userId, credentialIdBase64);

    if (!authenticator) {
      return res.status(400).json({ error: 'Authenticator not found' });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialPublicKey: authenticator.credential_public_key,
        credentialID: Buffer.from(authenticator.credential_id, 'base64'),
        counter: authenticator.counter,
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    // Update counter
    db.prepare('UPDATE authenticators SET counter = ? WHERE id = ?').run(
      verification.authenticationInfo.newCounter,
      authenticator.id
    );

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days

    db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      sessionId,
      userId,
      Date.now(),
      expiresAt
    );

    challenges.delete(userId);

    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);

    auditLog(AuditEvents.LOGIN_SUCCESS, user.username, true);

    res.json({
      verified: true,
      sessionId,
      username: user.username
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Logout
authRouter.post('/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'];

  if (sessionId) {
    const session = db.prepare('SELECT u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?').get(sessionId);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    if (session) {
      auditLog(AuditEvents.LOGOUT, session.username, true);
    }
  }

  res.json({ success: true });
});

// Check session
authRouter.get('/session', (req, res) => {
  const sessionId = req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(401).json({ error: 'No session' });
  }

  const session = db.prepare(`
    SELECT u.username
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, Date.now());

  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  res.json({ username: session.username });
});
