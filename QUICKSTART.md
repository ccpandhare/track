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

## Adding Users & Registration

### Generate Invite Code (Administrator)

```bash
cd backend
node generate-invite.js <username>
```

This will:
- Create a unique invite code
- Automatically add the username to the allowlist
- Display the code to send to the user

Example output:
```
✅ Invite code generated successfully!

Username:    alice
Invite Code: 9tAuYWyUHafzlY82tOwLbQ

✅ User automatically added to allowlist
```

### User Registration

Send the user:
1. Their username (e.g., `alice`)
2. The invite code (e.g., `9tAuYWyUHafzlY82tOwLbQ`)
3. The URL: https://track.chinmaypandhare.uk

They should:
1. Open the application in their browser
2. Enter their **exact username**
3. Enter the **invite code** (copy-paste recommended)
4. Click "Register with Passkey"
5. Follow browser prompts to create a passkey (Face ID, Touch ID, Windows Hello, etc.)
6. After registration, use "Login with Passkey" to sign in

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

### Registration Issues

**"Invalid invite code"**
- Double-check the code (copy-paste recommended)
- Make sure you're using the complete code
- Generate a new code if needed: `node generate-invite.js <username>`

**"This invite code is for username 'X'"**
- You must use the exact username the code was generated for
- Usernames are case-sensitive
- Ask administrator for the correct username

**"This invite code has already been used"**
- Invite codes are single-use only
- Contact administrator for a new invite code

**"Your account has not been authorized yet"**
- Your invite code is valid but you're not in the allowlist
- This shouldn't happen if `generate-invite.js` was used
- Contact administrator to check `allowlist.json`

### Other Issues

**Passkey not working**
- Use a modern browser (Chrome, Edge, Safari, Firefox)
- For production, HTTPS is required (localhost works for dev)
- Make sure your device supports WebAuthn (most modern devices do)

**Flight not found**
- Using FlightAware AeroAPI (not FlightRadar24)
- Check the flight number format (e.g., 6E5197, not 6E 5197)
- Make sure the flight exists for the selected date
- Verify your API key is correct in `.env`

**Backend not connecting**
- Check backend is running on port 3000
- Verify .env file exists and is configured
- Check logs for errors
