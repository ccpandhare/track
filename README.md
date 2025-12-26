# Flight Tracker

A web application to track flight data, aircraft positions, and predict delays using FlightRadar24 API.

## Features

- 🔐 Passkey-only authentication (WebAuthn)
- ✈️ Real-time flight tracking
- 🛩️ Aircraft position and details
- ⏰ Flight delay prediction
- 🔒 Secure API key management

## Setup

### Prerequisites

- Node.js >= 18.0.0
- FlightRadar24 API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ccpandhare/track.git
cd track
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

4. Create `.env` file in the backend directory:
```bash
cp backend/.env.example backend/.env
```

5. Add your FlightRadar24 API key to `backend/.env`:
```
FLIGHTRADAR24_API_KEY=your_api_key_here
RP_ID=track.chinmaypandhare.uk
ORIGIN=https://track.chinmaypandhare.uk
PORT=3000
```

6. Set up user allowlist for invite-only registration:
```bash
cp backend/allowlist.example.json backend/allowlist.json
```

Then edit `backend/allowlist.json` to add approved usernames:
```json
{
  "allowedUsers": [
    "chinmay",
    "admin"
  ]
}
```

Only usernames in this list will be allowed to register. The allowlist file is not committed to git.

### Development

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

### Production

Build frontend:
```bash
cd frontend
npm run build
```

Start backend:
```bash
cd backend
npm start
```

## Deployment

The application is configured to run on `track.chinmaypandhare.uk` with nginx and SSL via certbot.

## License

MIT
