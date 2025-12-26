import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { flightRouter } from './routes/flights.js';
import { authenticateUser } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/flights', authenticateUser, flightRouter);

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
