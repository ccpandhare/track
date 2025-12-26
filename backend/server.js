import dotenv from 'dotenv';
// Load environment variables FIRST before importing any routes
dotenv.config();

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { watch } from 'node:fs';
import { authRouter, reloadAllowlist as reloadAuthAllowlist } from './routes/auth.js';
import { flightRouter } from './routes/flights.js';
import { authenticateUser, reloadAllowlist as reloadMiddlewareAllowlist } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required when behind nginx
app.set('trust proxy', 1);

// Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`[SECURITY] Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many authentication attempts. Please try again in 15 minutes.' });
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 API requests per minute
  message: { error: 'Too many API requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({
  origin: process.env.ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes with rate limiting
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/flights', apiLimiter, authenticateUser, flightRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../frontend/dist'));

  app.get('*', (req, res) => {
    res.sendFile('/var/www/track/frontend/dist/index.html');
  });
}

// Watch allowlist.json for changes and hot-reload
watch('./allowlist.json', (eventType) => {
  if (eventType === 'change') {
    const authCount = reloadAuthAllowlist();
    reloadMiddlewareAllowlist();
    console.log(`[SECURITY] Allowlist hot-reloaded - ${authCount} users allowed`);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('[SECURITY] Allowlist hot-reload enabled');
});
