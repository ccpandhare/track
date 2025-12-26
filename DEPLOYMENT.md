# Deployment Guide

This guide will help you deploy the Flight Tracker application to your server at `track.chinmaypandhare.uk`.

## Prerequisites

- Ubuntu/Debian server with sudo access
- Node.js >= 18.0.0 installed
- Nginx installed
- Domain `track.chinmaypandhare.uk` pointing to your server's IP
- FlightRadar24 API key

## Step-by-Step Deployment

### 1. Clone and Setup Repository

```bash
# Clone the repository
cd /var/www
sudo git clone https://github.com/ccpandhare/track.git
cd track

# Set ownership
sudo chown -R www-data:www-data /var/www/track
```

### 2. Configure Environment Variables

```bash
# Copy and edit environment file
cd backend
cp .env.example .env
nano .env
```

Update the `.env` file with your settings:
```
FLIGHTRADAR24_API_KEY=your_actual_api_key_here
RP_ID=track.chinmaypandhare.uk
ORIGIN=https://track.chinmaypandhare.uk
PORT=3000
NODE_ENV=production
```

### 3. Configure User Allowlist

**IMPORTANT:** You don't need to manually edit the allowlist anymore! The invite code generation script automatically handles this.

However, you still need to create the initial file:

```bash
# Create allowlist from example
cd /var/www/track/backend
cp allowlist.example.json allowlist.json
```

The allowlist will be automatically populated when you generate invite codes (see "Adding New Users" section below).

### 4. Install Dependencies

```bash
# Backend dependencies
cd /var/www/track/backend
npm install

# Frontend dependencies
cd /var/www/track/frontend
npm install
```

### 5. Build Frontend

```bash
cd /var/www/track/frontend
npm run build
```

This creates optimized static files in `frontend/dist/`.

### 6. Setup Systemd Service

```bash
cd /var/www/track/config
sudo chmod +x setup-systemd.sh
sudo ./setup-systemd.sh

# Start the backend service
sudo systemctl start flight-tracker
sudo systemctl status flight-tracker
```

### 7. Configure Nginx

```bash
cd /var/www/track/config
sudo chmod +x setup-nginx.sh
sudo ./setup-nginx.sh

# Reload nginx
sudo systemctl reload nginx
```

### 8. Setup SSL with Certbot

**Important:** Make sure your domain DNS is pointing to your server before running this step.

```bash
cd /var/www/track/config

# Edit the email in setup-ssl.sh
sudo nano setup-ssl.sh
# Change: --email your-email@example.com

# Make executable and run
sudo chmod +x setup-ssl.sh
sudo ./setup-ssl.sh
```

If you prefer to run certbot manually:
```bash
sudo certbot --nginx -d track.chinmaypandhare.uk
```

### 9. Verify Deployment

1. Check backend service:
```bash
sudo systemctl status flight-tracker
sudo journalctl -u flight-tracker -f
```

2. Check nginx:
```bash
sudo nginx -t
sudo systemctl status nginx
```

3. Visit `https://track.chinmaypandhare.uk` in your browser

## Updating the Application

### Update Code

```bash
cd /var/www/track
sudo git pull origin main
```

### Update Backend

```bash
cd backend
sudo npm install
sudo systemctl restart flight-tracker
```

### Update Frontend

```bash
cd /var/www/track/frontend
sudo npm install
sudo npm run build
```

No nginx restart needed as static files are updated in place.

### Add New Users (Recommended Method)

**IMPORTANT:** Use the automated invite generation script instead of manually editing the allowlist!

```bash
cd /var/www/track/backend
node generate-invite.js <username>
```

**What this does:**
1. ✅ Creates a unique, secure invite code in the database
2. ✅ **Automatically adds the username to allowlist.json**
3. ✅ Shows the invite code to send to the user
4. ✅ No server restart needed (hot-reload)

**Example:**
```bash
cd /var/www/track/backend
node generate-invite.js alice

# Output:
# ✅ Invite code generated successfully!
#
# Username:    alice
# Invite Code: 9tAuYWyUHafzlY82tOwLbQ
#
# ✅ User automatically added to allowlist
#
# Send this code to alice to complete registration at:
# https://track.chinmaypandhare.uk
```

**Send to the user:**
- Username: `alice`
- Invite Code: `9tAuYWyUHafzlY82tOwLbQ`
- URL: https://track.chinmaypandhare.uk

**Security Features:**
- Each invite code is single-use
- Codes are tied to a specific username
- Codes cannot be reused or transferred
- Automatic audit logging of all registration attempts

### Manual Allowlist Update (Not Recommended)

Only use this if you need to remove a user:

```bash
cd /var/www/track/backend
sudo nano allowlist.json
# Remove the username from the array
# No restart needed - changes are hot-reloaded
```

**Note:** Simply removing from allowlist will:
- Block future login attempts
- Invalidate existing sessions on next API call
- Prevent registration even with valid invite code

## Monitoring

### View Backend Logs

```bash
# Follow logs in real-time
sudo journalctl -u flight-tracker -f

# View recent logs
sudo journalctl -u flight-tracker -n 100

# View errors only
sudo journalctl -u flight-tracker -p err
```

### View Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/track.chinmaypandhare.uk.access.log

# Error logs
sudo tail -f /var/log/nginx/track.chinmaypandhare.uk.error.log
```

### Check Service Status

```bash
# Backend service
sudo systemctl status flight-tracker

# Nginx
sudo systemctl status nginx

# SSL certificate expiry
sudo certbot certificates
```

## Troubleshooting

### Backend won't start

```bash
# Check logs
sudo journalctl -u flight-tracker -n 50

# Check if .env file exists and has correct values
cat /var/www/track/backend/.env

# Check if database is accessible
ls -la /var/www/track/backend/*.db

# Manually test the backend
cd /var/www/track/backend
node server.js
```

### 502 Bad Gateway

This usually means the backend is not running:
```bash
sudo systemctl start flight-tracker
sudo systemctl status flight-tracker
```

### SSL Certificate Issues

```bash
# Verify certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew

# Test renewal process
sudo certbot renew --dry-run
```

### Registration Issues

**Problem: "Registration is invite-only. This username is not authorized."**

This means the user is not in the allowlist. Fix:
```bash
cd /var/www/track/backend
node generate-invite.js <username>
```

This will automatically add them to the allowlist AND create their invite code.

**Problem: "Invalid invite code. Please check your code and try again."**

- The invite code was typed incorrectly (copy-paste recommended)
- The code doesn't exist in the database
- Fix: Generate a new invite code using the script above

**Problem: "This invite code has already been used."**

- The invite code was already used to register an account
- Fix: Generate a new invite code for the user

**Problem: "This invite code is for username 'X'. Please use the correct username."**

- The username doesn't match the invite code
- Each invite code is tied to a specific username
- Fix: Use the exact username the invite was generated for (case-sensitive)

**Problem: "Your account has not been authorized yet."**

- The invite code is valid but the user is not in the allowlist
- This should not happen if you used `generate-invite.js`
- Fix: Manually add the username to `allowlist.json` or re-run `generate-invite.js`

**Checking invite codes:**
```bash
cd /var/www/track/backend
node -e "
import('better-sqlite3').then(({default: Database}) => {
  const db = new Database('./users.db');
  const codes = db.prepare('SELECT code, username, created_at, used_at FROM invite_codes WHERE username = ?').all('USERNAME_HERE');
  console.log(JSON.stringify(codes, null, 2));
  db.close();
});
"
```

**Viewing audit logs for registration attempts:**
```bash
sudo journalctl -u flight-tracker | grep REGISTRATION
```

### Passkey Registration Not Working

1. Make sure you're accessing via HTTPS (required for WebAuthn)
2. Check that RP_ID and ORIGIN in `.env` match your domain
3. Verify username has a valid invite code (run `generate-invite.js`)
4. Use a modern browser (Chrome, Edge, Safari, Firefox)
5. Ensure device supports WebAuthn/passkeys

## Security Checklist

- [ ] `.env` file is not committed to git
- [ ] `allowlist.json` is not committed to git
- [ ] FlightRadar24 API key is secure and not exposed
- [ ] SSL certificate is installed and auto-renewing
- [ ] Only authorized users can register
- [ ] Backend is running as `www-data` user (limited permissions)
- [ ] Firewall allows only ports 80, 443, and 22

## Performance Optimization

### Enable Nginx Caching

Add to nginx config:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Enable HTTP/2

Already enabled in the provided config with `http2` directive.

### Monitor Resource Usage

```bash
# Check disk usage
df -h

# Check memory
free -h

# Check CPU
top
```

## Backup

### Database Backup

```bash
# Create backup
sudo cp /var/www/track/backend/users.db /var/www/track/backend/users.db.backup-$(date +%Y%m%d)

# Automate with cron (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * cp /var/www/track/backend/users.db /var/www/track/backend/users.db.backup-$(date +\%Y\%m\%d)
```

### Full Application Backup

```bash
# Backup entire application (excluding node_modules)
sudo tar -czf track-backup-$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  /var/www/track
```
