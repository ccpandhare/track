# Quick Start Guide

## For Development (Local Testing)

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Setup Environment

```bash
# Backend environment
cd backend
cp .env.example .env
nano .env
```

For local development, use:
```
FLIGHTRADAR24_API_KEY=your_api_key
RP_ID=localhost
ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
```

### 3. Setup User Allowlist

```bash
cd backend
cp allowlist.example.json allowlist.json
nano allowlist.json
```

Add your test username:
```json
{
  "allowedUsers": [
    "testuser"
  ]
}
```

### 4. Start Development Servers

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### 5. Access the App

Open http://localhost:5173 in your browser.

**Important:** Passkeys require HTTPS in production, but work on localhost for development.

## For Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete production deployment instructions.

Quick summary:
```bash
# 1. Setup environment and dependencies
cd backend && npm install && cd ../frontend && npm install

# 2. Configure .env and allowlist.json

# 3. Build frontend
cd frontend && npm run build

# 4. Setup systemd, nginx, and SSL
cd ../config
sudo ./setup-systemd.sh
sudo ./setup-nginx.sh
sudo ./setup-ssl.sh
```

## First User Registration

1. Open the application in your browser
2. Enter a username that's in your `allowlist.json`
3. Click "Register with Passkey"
4. Follow your browser/device prompts to create a passkey
5. After registration, use "Login with Passkey" to sign in

## Testing Flight Search

Once logged in:
1. Enter a flight number (e.g., BA123, AA100, DL456)
2. Select a date (defaults to today)
3. Click Search
4. View flight details, aircraft info, and delay predictions

## API Key Setup

You need a FlightRadar24 API key. If you don't have one:
1. Sign up at FlightRadar24
2. Subscribe to their API service
3. Add the key to your `.env` file

## Troubleshooting

**"Registration is invite-only"**
- Make sure your username is in `backend/allowlist.json`

**"Could not load allowlist.json"**
- Copy `allowlist.example.json` to `allowlist.json`
- Restart the backend server

**Passkey not working**
- Use a modern browser (Chrome, Edge, Safari, Firefox)
- For production, HTTPS is required
- Make sure your device supports WebAuthn (most do)

**Flight not found**
- Verify your FlightRadar24 API key is correct
- Check the flight number format (e.g., BA123, not BA 123)
- Make sure the flight exists for the selected date

**Backend not connecting**
- Check backend is running on port 3000
- Verify .env file exists and is configured
- Check logs for errors
