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

```bash
# Create allowlist from example
cp allowlist.example.json allowlist.json
nano allowlist.json
```

Add the usernames you want to allow:
```json
{
  "allowedUsers": [
    "chinmay",
    "yourusername"
  ]
}
```

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

### Update Allowlist

```bash
cd /var/www/track/backend
sudo nano allowlist.json
# No restart needed - will be loaded on next registration attempt
```

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

### Passkey Registration Not Working

1. Make sure you're accessing via HTTPS (required for WebAuthn)
2. Check that RP_ID and ORIGIN in `.env` match your domain
3. Verify username is in `allowlist.json`

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
