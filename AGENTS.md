# Flight Tracker - Agent Notes

## Project Overview

Flight Tracker is a flight tracking application built with Node.js/Express backend and vanilla JavaScript frontend (Vite build).

**Authentication:** Uses central auth service at auth.chinmaypandhare.uk (SSO across all chinmaypandhare.uk subdomains).

## Critical Deployment Information

### Systemd Service Configuration

**Service Name:** `flight-tracker.service`

**IMPORTANT:** The systemd service MUST use `Restart=always` instead of `Restart=on-failure` to ensure the service restarts after system reboots or clean shutdowns.

**Location:** `/etc/systemd/system/flight-tracker.service`

**After modifying the service file:**
```bash
systemctl daemon-reload
systemctl restart flight-tracker.service
systemctl status flight-tracker.service
```

**Common Issue:** If users report "request failed" errors during login, the backend service is likely down. Check:
```bash
systemctl status flight-tracker.service
journalctl -u flight-tracker.service -n 50
```

### Service Management Commands

```bash
# Check service status
systemctl status flight-tracker.service

# Start service
systemctl start flight-tracker.service

# Stop service
systemctl stop flight-tracker.service

# Restart service
systemctl restart flight-tracker.service

# View logs
journalctl -u flight-tracker.service -n 50 --no-pager

# Follow logs in real-time
journalctl -u flight-tracker.service -f
```

## Architecture

### Backend
- **Location:** `/var/www/track/backend/`
- **Entry Point:** `server.js`
- **Port:** 3000 (proxied by nginx)
- **Database:** SQLite3 at `backend/users.db`
- **Configuration:** `backend/.env` (RP_ID, ORIGIN, FLIGHTAWARE_API_KEY, etc.)

### Frontend
- **Source:** `/var/www/track/frontend/`
- **Build Output:** `/var/www/track/frontend/dist/`
- **Build Tool:** Vite
- **Build Command:** `npm run build` (in frontend directory)

### Nginx
- **Config:** `/etc/nginx/sites-available/track.chinmaypandhare.uk`
- **Proxy:** `/api/` → `http://localhost:3000/api/`
- **Static Files:** Served from `/var/www/track/frontend/dist/`

## Authentication

### Central Auth Integration (Current)

Track now uses the central authentication service at **auth.chinmaypandhare.uk** for SSO across all subdomains.

**How it works:**
1. User visits track.chinmaypandhare.uk
2. Backend checks for `ccp_auth_token` cookie (set on .chinmaypandhare.uk domain)
3. If no cookie, frontend redirects to `auth.chinmaypandhare.uk/login?service=track&redirect=...`
4. User authenticates with passkey on central auth
5. Central auth sets `ccp_auth_token` cookie and redirects back to track
6. Track backend verifies session by calling `auth.chinmaypandhare.uk/api/verify?service=track`

**Key Files:**
- `backend/middleware/auth.js` - Verifies sessions with central auth
- `frontend/main.js` - Handles login redirect to central auth

**Central Auth Endpoints Used:**
- `GET /api/verify?service=track` - Verify session and service access
- `POST /api/auth/logout` - Clear session cookie

**Cookie:**
- Name: `ccp_auth_token`
- Domain: `.chinmaypandhare.uk` (shared across subdomains)
- HttpOnly, Secure, SameSite=Lax

**Testing Auth:**
```bash
# Without session (should return redirect URL)
curl -s https://track.chinmaypandhare.uk/api/auth/session

# With valid session
curl -s https://track.chinmaypandhare.uk/api/auth/session -H "Cookie: ccp_auth_token=<session_id>"
```

### Legacy WebAuthn (Preserved as Backup)

The original passkey authentication code is preserved in `backend/routes/auth.js` but is not used for new logins. All registration/login now goes through central auth.

**Note:** The allowlist.json file is still watched for backward compatibility but has no effect with central auth. User access is now managed via the central auth service's user_services table.

### Audit Logging
- All auth events logged via `backend/utils/audit.js`
- Events: LOGIN_ATTEMPT, LOGIN_BLOCKED, REGISTRATION_ATTEMPT, etc.
- Logs visible in systemd journal

## Deployment Workflow

1. **Backend Changes:**
   ```bash
   cd /var/www/track/backend
   # Make changes to server.js, routes, etc.
   systemctl restart flight-tracker.service
   systemctl status flight-tracker.service
   ```

2. **Frontend Changes:**
   ```bash
   cd /var/www/track/frontend
   # Make changes to main.js, index.html, style.css, etc.
   npm run build
   # Frontend is automatically served by nginx from dist/
   ```

3. **Nginx Configuration Changes:**
   ```bash
   # Edit /etc/nginx/sites-available/track.chinmaypandhare.uk
   nginx -t  # Test configuration
   systemctl reload nginx
   ```

## Troubleshooting

### Login Fails with "Request Failed"

**Symptom:** Users see "request failed" error on login page.

**Cause:** Backend service is down.

**Solution:**
```bash
# Check if service is running
systemctl status flight-tracker.service

# If not running, start it
systemctl start flight-tracker.service

# Check logs for errors
journalctl -u flight-tracker.service -n 50
```

### Service Not Starting After Reboot

**Symptom:** Service doesn't auto-start after system reboot.

**Cause:** `Restart=on-failure` in systemd config (only restarts on crashes, not after clean shutdown/reboot).

**Solution:** Change to `Restart=always` in `/etc/systemd/system/flight-tracker.service`:
```bash
# Edit the service file
# Change: Restart=on-failure
# To: Restart=always
systemctl daemon-reload
systemctl restart flight-tracker.service
```

### Nginx Returns 502 Bad Gateway

**Symptom:** Nginx returns 502 error when accessing the site.

**Cause:** Backend service is not running or not listening on port 3000.

**Solution:**
```bash
# Check backend service
systemctl status flight-tracker.service

# Check if port 3000 is listening
ss -tulpn | grep :3000

# Check nginx error logs
tail -30 /var/log/nginx/track.chinmaypandhare.uk.error.log
```

### Frontend Not Updating

**Symptom:** Frontend changes don't appear on the live site.

**Cause:** Frontend not rebuilt after changes.

**Solution:**
```bash
cd /var/www/track/frontend
npm run build
# Changes now visible at https://track.chinmaypandhare.uk
```

## Important File Paths

- **Backend:** `/var/www/track/backend/`
- **Frontend:** `/var/www/track/frontend/`
- **Frontend Build:** `/var/www/track/frontend/dist/`
- **Systemd Service:** `/etc/systemd/system/flight-tracker.service`
- **Nginx Config:** `/etc/nginx/sites-available/track.chinmaypandhare.uk`
- **Database:** `/var/www/track/backend/users.db`
- **Allowlist:** `/var/www/track/backend/allowlist.json`
- **Environment:** `/var/www/track/backend/.env`
- **Nginx Logs:** `/var/log/nginx/track.chinmaypandhare.uk.{access,error}.log`

## Testing

### Test Backend API
```bash
# Health check
curl -s https://track.chinmaypandhare.uk/api/health

# Test auth without session (should return redirect URL)
curl -s https://track.chinmaypandhare.uk/api/auth/session

# Test auth with valid session from central auth
curl -s https://track.chinmaypandhare.uk/api/auth/session -H "Cookie: ccp_auth_token=<session_id>"
```

### Check Database
```bash
cd /var/www/track/backend
node -e "const db = require('better-sqlite3')('users.db'); console.log(db.prepare('SELECT id, username, created_at FROM users').all());"
```

## Common Tasks

### Grant User Access to Track Service

With central auth, user access is managed at auth.chinmaypandhare.uk:

```bash
cd /var/www/auth/backend
# Grant track access to existing user
node -e "
const db = require('./db.js').default || require('./db.js');
const userId = db.prepare('SELECT id FROM users WHERE username = ?').get('username')?.id;
const serviceId = db.prepare('SELECT id FROM services WHERE name = ?').get('track')?.id;
if (userId && serviceId) {
  db.prepare('INSERT OR IGNORE INTO user_services (user_id, service_id, granted_at) VALUES (?, ?, ?)').run(userId, serviceId, Date.now());
  console.log('Access granted');
}
"
```

Or use the admin dashboard at auth.chinmaypandhare.uk/admin.

### Create New User Invite

New users must be invited via central auth:

```bash
cd /var/www/auth/backend
node generate-invite.js <username> track,homefinder  # comma-separated services
```

### View Audit Logs
```bash
journalctl -u flight-tracker.service | grep AUDIT
```

### Clear Failed Login Attempts
Rate limiting is IP-based and resets after 15 minutes automatically.

### Service Crashes Due to Native Module Version Mismatch

**Symptom:** Service continuously crashes with error "NODE_MODULE_VERSION mismatch" for better-sqlite3.

**Cause:** Node.js was upgraded but native modules (better-sqlite3) were not rebuilt for the new version.

**Solution:**
```bash
# Install build tools if not present
apt-get update && apt-get install -y build-essential

# Rebuild native modules
cd /var/www/track/backend
npm rebuild

# Restart service
systemctl restart flight-tracker.service
systemctl status flight-tracker.service
```

**Important:** After any Node.js version upgrade, always rebuild native modules to prevent this issue.
