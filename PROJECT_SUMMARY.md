# Flight Tracker - Project Summary

## Overview

A secure web application for tracking flights using FlightRadar24 API with passkey-only authentication.

## Technology Stack

### Backend
- **Runtime:** Node.js (ES Modules)
- **Framework:** Express.js
- **Authentication:** WebAuthn (Passkeys) via @simplewebauthn/server
- **Database:** SQLite3 (better-sqlite3)
- **API Integration:** FlightRadar24 API
- **Environment:** dotenv

### Frontend
- **Build Tool:** Vite
- **Authentication:** @simplewebauthn/browser
- **UI:** Vanilla HTML/CSS/JavaScript (no framework dependencies)
- **Styling:** Modern CSS with responsive design

### Infrastructure
- **Web Server:** Nginx (reverse proxy + static file serving)
- **SSL:** Let's Encrypt via Certbot
- **Process Manager:** systemd
- **Domain:** track.chinmaypandhare.uk

## Key Features

### 1. Passkey-Only Authentication
- No passwords required
- Uses WebAuthn/FIDO2 standard
- Biometric or hardware key authentication
- Session management with secure tokens
- **Invite-only registration** via secure invite codes
- Two-layer security: invite codes + allowlist
- Automated invite code generation with `generate-invite.js`

### 2. Flight Tracking
- Search flights by flight number and date
- Real-time flight status
- Departure and arrival information
- Flight route details
- FlightAware AeroAPI integration

### 3. Aircraft Information
- Aircraft registration number
- Aircraft model and type
- Current position (latitude/longitude)
- Current altitude, speed, and heading
- Airline information

### 4. Inbound Aircraft Tracking
- **NEW:** Dedicated section showing inbound flight details
- Displays the previous flight using the same aircraft
- Complete inbound flight information:
  - Flight number, route, and status
  - Scheduled and actual times
  - Delay information
  - Aircraft registration
- Always visible when data is available
- Helps understand delay propagation

### 5. Delay Prediction
- Current delay calculation
- Predicted arrival delay based on inbound aircraft
- Delay reason analysis (inbound delay, departure delay, etc.)
- Confidence indicators (high/medium/low)
- Visual delay status (on-time, minor, major)
- Inbound aircraft delay impact tracking

### 6. Security Features
- API key stored server-side only
- Not exposed to frontend
- Environment variable based configuration
- User allowlist with hot-reload (no restart needed)
- HTTPS required for production
- Security headers configured in nginx
- Rate limiting (5 auth attempts/15min, 30 API requests/min)
- Comprehensive audit logging
- Session invalidation on user removal from allowlist

## File Structure

```
/var/www/track/
├── backend/
│   ├── server.js                 # Express server entry point
│   ├── db.js                     # SQLite database setup
│   ├── package.json              # Backend dependencies
│   ├── .env.example              # Environment template
│   ├── allowlist.json            # User allowlist (not in git)
│   ├── allowlist.example.json    # Allowlist template
│   ├── middleware/
│   │   └── auth.js               # Session authentication middleware
│   └── routes/
│       ├── auth.js               # Passkey auth endpoints
│       └── flights.js            # FlightRadar24 API endpoints
│
├── frontend/
│   ├── index.html                # Main HTML file
│   ├── main.js                   # Application logic
│   ├── style.css                 # Styling
│   ├── vite.config.js            # Vite configuration
│   └── package.json              # Frontend dependencies
│
├── config/
│   ├── nginx-track.conf          # Nginx site configuration
│   ├── systemd-backend.service   # Systemd service definition
│   ├── setup-nginx.sh            # Nginx setup script
│   ├── setup-ssl.sh              # SSL/certbot setup script
│   └── setup-systemd.sh          # Systemd setup script
│
├── README.md                      # Project overview
├── QUICKSTART.md                  # Quick start guide
├── DEPLOYMENT.md                  # Detailed deployment guide
├── PROJECT_SUMMARY.md             # This file
└── .gitignore                     # Git ignore rules

Generated:
├── backend/users.db              # SQLite database (not in git)
└── frontend/dist/                # Built frontend files (not in git)
```

## Database Schema

### Users Table
- `id` - UUID primary key
- `username` - Unique username
- `created_at` - Registration timestamp

### Authenticators Table
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `credential_id` - WebAuthn credential ID
- `credential_public_key` - Public key blob
- `counter` - Signature counter for replay protection
- `credential_device_type` - Device type
- `credential_backed_up` - Backup status
- `transports` - Supported transports (JSON)
- `created_at` - Registration timestamp

### Sessions Table
- `id` - Session UUID
- `user_id` - Foreign key to users
- `created_at` - Session start time
- `expires_at` - Session expiration (30 days)

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register/start` - Start passkey registration
- `POST /register/finish` - Complete passkey registration
- `POST /login/start` - Start passkey authentication
- `POST /login/finish` - Complete passkey authentication
- `POST /logout` - End session
- `GET /session` - Check current session

### Flights (`/api/flights`) - Requires authentication
- `GET /search?flightNumber=XX123&date=YYYY-MM-DD` - Search flights
- `GET /details/:flightId` - Get flight details
- `GET /aircraft/:registration` - Get aircraft info
- `GET /track/:flightId` - Get flight track/position history
- `GET /delay-prediction/:flightId` - Get delay prediction

## Environment Variables

```bash
# FlightRadar24 API
FLIGHTRADAR24_API_KEY=your_api_key

# WebAuthn Configuration
RP_ID=track.chinmaypandhare.uk          # Relying Party ID (domain)
ORIGIN=https://track.chinmaypandhare.uk # Expected origin

# Server
PORT=3000                                # Backend port
NODE_ENV=production                      # Environment (development/production)
```

## User Registration System

### Invite Code Generation

The app uses a two-layer security system for user registration:

1. **Invite Codes** - Stored in SQLite database, one per user
2. **Allowlist** - JSON file with authorized usernames

**To add a new user:**
```bash
cd backend
node generate-invite.js <username>
```

This automatically:
- Creates a unique invite code in the database
- Adds username to `allowlist.json`
- Shows the code to send to the user

**Database Table: `invite_codes`**
- `code` - Unique invite code (base64url, 16 bytes)
- `username` - Associated username (unique)
- `created_at` - Timestamp
- `used_at` - Timestamp when used (null if unused)
- `used_by_user_id` - User ID who used it

### Allowlist Configuration

File: `backend/allowlist.json` (not committed to git, auto-managed)

```json
{
  "allowedUsers": [
    "chinmay",
    "regina",
    "approved_username"
  ],
  "comment": "Only these usernames can register"
}
```

**Features:**
- Hot-reload: Changes take effect immediately (no restart needed)
- Auto-populated by `generate-invite.js`
- Checked on registration, login, and every API call
- Remove users to revoke access (invalidates sessions)

## Deployment Checklist

- [ ] Node.js installed
- [ ] Git repository cloned
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] `.env` file configured with API key
- [ ] `allowlist.json` created with approved users
- [ ] Frontend built (`npm run build`)
- [ ] Systemd service configured and started
- [ ] Nginx configured
- [ ] DNS pointing to server
- [ ] SSL certificate obtained
- [ ] Application accessible via HTTPS

## How to Push to GitHub

The repository is initialized and ready. To push to GitHub:

```bash
# Make sure you have access to the GitHub repository
# You may need to authenticate via SSH key or personal access token

# Push to GitHub
git push -u origin main

# For subsequent pushes
git push
```

## Next Steps After Deployment

1. **Test Registration:**
   - Visit https://track.chinmaypandhare.uk
   - Register with a username from allowlist
   - Create passkey on your device

2. **Test Flight Search:**
   - Login with passkey
   - Search for a real flight (e.g., BA123)
   - Verify all data displays correctly

3. **Monitor Logs:**
   - Backend: `sudo journalctl -u flight-tracker -f`
   - Nginx: `sudo tail -f /var/log/nginx/track.chinmaypandhare.uk.access.log`

4. **Add More Users:**
   - Edit `backend/allowlist.json`
   - Add new usernames
   - Users can then register

5. **Backup Database:**
   - Setup automated backups of `backend/users.db`
   - Consider daily cron job

## Support & Maintenance

### Update Application
```bash
cd /var/www/track
git pull origin main
cd backend && npm install
cd ../frontend && npm install && npm run build
sudo systemctl restart flight-tracker
```

### View Logs
```bash
# Backend logs
sudo journalctl -u flight-tracker -f

# Nginx access logs
sudo tail -f /var/log/nginx/track.chinmaypandhare.uk.access.log

# Nginx error logs
sudo tail -f /var/log/nginx/track.chinmaypandhare.uk.error.log
```

### Check SSL Certificate
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

## Security Considerations

1. **API Key Security:**
   - Never commit `.env` to git
   - API key only accessible server-side
   - Not exposed to frontend or users

2. **Allowlist Security:**
   - `allowlist.json` not committed to git
   - Only approved usernames can register
   - Easy to add/remove users

3. **Passkey Security:**
   - FIDO2/WebAuthn standard
   - Phishing-resistant authentication
   - No shared secrets
   - Device-based authentication

4. **Transport Security:**
   - HTTPS enforced
   - HTTP redirects to HTTPS
   - Modern TLS configuration
   - Security headers configured

5. **Session Security:**
   - 30-day session expiration
   - Session tokens in headers
   - Database-backed sessions

## License

MIT
