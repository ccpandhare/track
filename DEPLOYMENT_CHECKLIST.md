# Deployment Checklist for track.chinmaypandhare.uk

Use this checklist to deploy the Flight Tracker application step by step.

## Pre-Deployment

- [ ] DNS record for `track.chinmaypandhare.uk` points to server IP
- [ ] Server has Node.js >= 18.0.0 installed
- [ ] Server has nginx installed
- [ ] You have your FlightRadar24 API key ready
- [ ] Repository pushed to GitHub (if deploying from GitHub)

## Deployment Steps

### 1. Get the Code

```bash
cd /var/www
sudo git clone https://github.com/ccpandhare/track.git
cd track
```

- [ ] Code cloned successfully

### 2. Install Dependencies

```bash
# Backend
cd backend
sudo npm install

# Frontend
cd ../frontend
sudo npm install
```

- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed

### 3. Configure Environment

```bash
cd /var/www/track/backend
sudo cp .env.example .env
sudo nano .env
```

Update with your values:
```
FLIGHTRADAR24_API_KEY=your_actual_api_key
RP_ID=track.chinmaypandhare.uk
ORIGIN=https://track.chinmaypandhare.uk
PORT=3000
NODE_ENV=production
```

- [ ] `.env` file created
- [ ] API key added
- [ ] Domain settings correct

### 4. Configure User Allowlist

```bash
cd /var/www/track/backend
sudo cp allowlist.example.json allowlist.json
sudo nano allowlist.json
```

Add approved usernames:
```json
{
  "allowedUsers": [
    "chinmay",
    "yourusername"
  ]
}
```

- [ ] `allowlist.json` created
- [ ] Usernames added

### 5. Build Frontend

```bash
cd /var/www/track/frontend
sudo npm run build
```

- [ ] Frontend built successfully (check `dist/` folder exists)

### 6. Setup Backend Service

```bash
cd /var/www/track/config
sudo ./setup-systemd.sh
sudo systemctl start flight-tracker
sudo systemctl status flight-tracker
```

- [ ] Systemd service installed
- [ ] Service started successfully
- [ ] Service status shows "active (running)"

Check logs if needed:
```bash
sudo journalctl -u flight-tracker -n 50
```

### 7. Setup Nginx (HTTP first)

```bash
cd /var/www/track/config
sudo ./setup-nginx.sh
```

This will install the HTTP-only config since SSL isn't set up yet.

- [ ] Nginx config installed
- [ ] nginx -t passes successfully

Reload nginx:
```bash
sudo systemctl reload nginx
```

- [ ] Nginx reloaded

### 8. Test HTTP Access

Visit `http://track.chinmaypandhare.uk` (note: HTTP not HTTPS yet)

- [ ] Site loads (may show passkey error - that's OK, HTTPS needed)
- [ ] No 502 Bad Gateway error
- [ ] Backend is responding

### 9. Setup SSL Certificate

```bash
cd /var/www/track/config
sudo ./setup-ssl.sh
```

When prompted, enter your email for Let's Encrypt notifications.

- [ ] SSL certificate obtained
- [ ] Nginx updated to HTTPS config
- [ ] Nginx reloaded automatically

### 10. Test HTTPS Access

Visit `https://track.chinmaypandhare.uk`

- [ ] Site loads over HTTPS
- [ ] SSL certificate is valid (no browser warning)
- [ ] Can see login/register page

### 11. Test Registration and Login

- [ ] Enter a username from allowlist
- [ ] Click "Register with Passkey"
- [ ] Passkey creation succeeds
- [ ] Can login with passkey
- [ ] Reaches main flight search page

### 12. Test Flight Search

- [ ] Enter a real flight number (e.g., BA123, AA100)
- [ ] Search returns results
- [ ] Flight details display
- [ ] Aircraft info displays
- [ ] Delay prediction shows

## Post-Deployment

### Security Check

- [ ] `.env` file NOT in git (check with `git status`)
- [ ] `allowlist.json` NOT in git
- [ ] API key not visible in browser dev tools
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Passkey registration limited to allowlist users

### Monitoring Setup

Add to crontab for daily database backups:
```bash
sudo crontab -e
```

Add line:
```
0 2 * * * cp /var/www/track/backend/users.db /var/www/track/backend/users.db.backup-$(date +\%Y\%m\%d)
```

- [ ] Backup cron job added

### Verify Auto-Renewal

```bash
sudo certbot renew --dry-run
```

- [ ] Dry run succeeds

## Troubleshooting

### If backend won't start:
```bash
sudo journalctl -u flight-tracker -n 100
cd /var/www/track/backend
node server.js  # Test manually
```

### If 502 Bad Gateway:
```bash
sudo systemctl status flight-tracker
sudo systemctl start flight-tracker
```

### If passkeys don't work:
- Make sure using HTTPS (required for WebAuthn)
- Check browser console for errors
- Verify RP_ID and ORIGIN in `.env` match domain

### If "Registration is invite-only" error:
- Check username is in `backend/allowlist.json`
- Verify JSON syntax is correct

## Final Status

Date deployed: _______________

- [ ] All checks passed
- [ ] Application fully functional
- [ ] Monitoring in place
- [ ] Documentation updated

## Quick Commands Reference

```bash
# View backend logs
sudo journalctl -u flight-tracker -f

# Restart backend
sudo systemctl restart flight-tracker

# Restart nginx
sudo systemctl restart nginx

# Check SSL certificates
sudo certbot certificates

# Update code
cd /var/www/track && sudo git pull

# Rebuild frontend
cd frontend && sudo npm run build

# Add user to allowlist
sudo nano backend/allowlist.json
```
