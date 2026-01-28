# Flight Tracker - Agent Notes

## Project Overview

Flight Tracker is a passkey-based flight tracking application built with Node.js/Express backend and vanilla JavaScript frontend (Vite build).

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

### WebAuthn/Passkeys
- Uses `@simplewebauthn/server` (backend) and `@simplewebauthn/browser` (frontend)
- No passwords - passkey-only authentication
- Invite code system for registration
- Allowlist enforcement (in `backend/allowlist.json`)

### Allowlist Management
- **File:** `backend/allowlist.json`
- Hot-reloadable (service watches for changes)
- Users MUST be in allowlist to register or login

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
curl -k https://track.chinmaypandhare.uk/api/health

# Test login/start endpoint
curl -k -X POST https://track.chinmaypandhare.uk/api/auth/login/start \
  -H "Content-Type: application/json" \
  -d '{"username": "ch64pn"}'
```

### Check Database
```bash
cd /var/www/track/backend
node -e "const db = require('better-sqlite3')('users.db'); console.log(db.prepare('SELECT id, username, created_at FROM users').all());"
```

## Common Tasks

### Add User to Allowlist
1. Edit `backend/allowlist.json`
2. Add username to `allowedUsers` array
3. Service will hot-reload automatically (no restart needed)

### Generate Invite Code
```bash
cd /var/www/track/backend
node generate-invite.js <username>
```

### View Audit Logs
```bash
journalctl -u flight-tracker.service | grep AUDIT
```

### Clear Failed Login Attempts
Rate limiting is IP-based and resets after 15 minutes automatically.
