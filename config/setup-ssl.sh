#!/bin/bash

# SSL setup script using certbot
# Run this script as root or with sudo

set -e

echo "Setting up SSL certificate for track.chinmaypandhare.uk..."

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "Certbot is not installed. Installing..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Check if site is enabled in nginx
if [ ! -f /etc/nginx/sites-enabled/track.chinmaypandhare.uk ]; then
    echo "Error: Nginx site not enabled. Run setup-nginx.sh first."
    exit 1
fi

# Get email for Let's Encrypt
echo "Enter email address for Let's Encrypt notifications:"
read -r EMAIL

if [ -z "$EMAIL" ]; then
    echo "Error: Email is required"
    exit 1
fi

# Obtain SSL certificate
echo "Obtaining SSL certificate..."
certbot --nginx -d track.chinmaypandhare.uk --non-interactive --agree-tos --email "$EMAIL"

# Copy the full HTTPS configuration now that we have certs
echo "Updating nginx configuration to use HTTPS..."
cp /var/www/track/config/nginx-track.conf /etc/nginx/sites-available/track.chinmaypandhare.uk

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

# Reload nginx
echo "Reloading nginx..."
systemctl reload nginx

# Setup auto-renewal
echo "Setting up automatic renewal..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
echo "SSL certificate installed successfully!"
echo "Certificate will auto-renew before expiration."
echo "Site is now accessible at https://track.chinmaypandhare.uk"
echo ""
