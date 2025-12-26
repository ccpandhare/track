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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const authRouter = express.Router();

const rpName = 'Flight Tracker';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || 'http://localhost:5173';

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

const allowedUsers = loadAllowlist();

// Registration start
authRouter.post('/register/start', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  // Check if username is in allowlist
  if (!allowedUsers.has(username)) {
    return res.status(403).json({ error: 'Registration is invite-only. This username is not authorized.' });
  }

  // Check if user exists
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUser) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const userId = crypto.randomUUID();

  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID: userId,
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
  const { userId, username, credential } = req.body;

  const expectedChallenge = challenges.get(userId);
  if (!expectedChallenge) {
    return res.status(400).json({ error: 'Invalid challenge' });
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

    challenges.delete(userId);

    res.json({ verified: true });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Authentication start
authRouter.post('/login/start', (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(400).json({ error: 'User not found' });
  }

  const authenticators = db.prepare(`
    SELECT credential_id, transports
    FROM authenticators
    WHERE user_id = ?
  `).all(user.id);

  const options = generateAuthenticationOptions({
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
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
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
