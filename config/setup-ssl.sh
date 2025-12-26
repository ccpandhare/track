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

# Obtain SSL certificate
echo "Obtaining SSL certificate..."
certbot --nginx -d track.chinmaypandhare.uk --non-interactive --agree-tos --email your-email@example.com

# Setup auto-renewal
echo "Setting up automatic renewal..."
systemctl enable certbot.timer
systemctl start certbot.timer

echo ""
echo "SSL certificate installed successfully!"
echo "Certificate will auto-renew before expiration."
echo ""
