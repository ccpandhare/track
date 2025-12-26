# Flight Tracker

A secure web application to track flight data, aircraft positions, and predict delays using FlightAware AeroAPI.

**Live:** https://track.chinmaypandhare.uk

## Features

- 🔐 **Passkey-only authentication** (WebAuthn/FIDO2)
- 🎫 **Invite-only registration** with secure invite codes
- ✈️ **Real-time flight tracking** with FlightAware AeroAPI
- 🛩️ **Aircraft information** including position and details
- 🔄 **Inbound aircraft tracking** to understand delay propagation
- ⏰ **Delay prediction** based on inbound aircraft delays
- 🔒 **Secure API key management** (server-side only)
- 🛡️ **Rate limiting** and comprehensive audit logging
- ♻️ **Hot-reload** for user allowlist changes

## Setup

### Prerequisites

- Node.js >= 18.0.0
- FlightAware AeroAPI key (free tier available)

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

5. Add your FlightAware API key to `backend/.env`:
```
FLIGHTAWARE_API_KEY=your_aeroapi_key_here
RP_ID=localhost
ORIGIN=http://localhost:5173
PORT=3000
NODE_ENV=development
```

6. Set up user allowlist:
```bash
cp backend/allowlist.example.json backend/allowlist.json
```

7. Generate invite code for your first user:
```bash
cd backend
node generate-invite.js yourusername
```

This will:
- Create a secure invite code
- Automatically add your username to `allowlist.json`
- Display the invite code to use for registration

**Note:** The allowlist is auto-managed by the invite generation script. No manual editing needed!

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

## User Management

### Adding New Users

```bash
cd backend
node generate-invite.js <username>
```

This creates an invite code and automatically adds the user to the allowlist.

### Removing Users

Edit `backend/allowlist.json` and remove the username. Changes take effect immediately (hot-reload).

### Viewing Invite Codes

```bash
cd backend
node -e "
import('better-sqlite3').then(({default: Database}) => {
  const db = new Database('./users.db');
  const codes = db.prepare('SELECT code, username, created_at, used_at FROM invite_codes').all();
  console.log(JSON.stringify(codes, null, 2));
  db.close();
});
"
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.

Quick summary:
- Nginx reverse proxy with SSL (Let's Encrypt)
- Systemd service for backend
- Production configuration at `track.chinmaypandhare.uk`

## Documentation

- [QUICKSTART.md](QUICKSTART.md) - Quick start guide for development and production
- [DEPLOYMENT.md](DEPLOYMENT.md) - Detailed deployment instructions
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Complete project overview
- [SECURITY_FIXES_SUMMARY.md](SECURITY_FIXES_SUMMARY.md) - Security enhancements documentation

## Troubleshooting

### Registration Issues

See [DEPLOYMENT.md#registration-issues](DEPLOYMENT.md#registration-issues) for detailed troubleshooting.

Common fixes:
- **"Invalid invite code"**: Generate a new code with `node generate-invite.js <username>`
- **"This invite code is for username 'X'"**: Use the exact username (case-sensitive)
- **"Account not authorized"**: User not in allowlist - re-run `generate-invite.js`

## License

MIT
