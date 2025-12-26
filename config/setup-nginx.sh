#!/bin/bash

# Setup script for nginx configuration
# Run this script as root or with sudo

set -e

echo "Setting up nginx configuration for track.chinmaypandhare.uk..."

# Check if SSL certificates already exist
if [ -f "/etc/letsencrypt/live/track.chinmaypandhare.uk/fullchain.pem" ]; then
    echo "SSL certificates found. Using full HTTPS configuration..."
    cp /var/www/track/config/nginx-track.conf /etc/nginx/sites-available/track.chinmaypandhare.uk
else
    echo "No SSL certificates found. Using HTTP-only configuration..."
    echo "Run setup-ssl.sh after this to enable HTTPS"
    cp /var/www/track/config/nginx-track-initial.conf /etc/nginx/sites-available/track.chinmaypandhare.uk
fi

# Create symlink to enable site
echo "Enabling site..."
ln -sf /etc/nginx/sites-available/track.chinmaypandhare.uk /etc/nginx/sites-enabled/

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

echo ""
echo "Nginx configuration installed successfully!"
echo ""
echo "Next steps:"
echo "1. Make sure DNS is pointing track.chinmaypandhare.uk to this server"
echo "2. Reload nginx: sudo systemctl reload nginx"
if [ ! -f "/etc/letsencrypt/live/track.chinmaypandhare.uk/fullchain.pem" ]; then
    echo "3. Run setup-ssl.sh to get SSL certificate and enable HTTPS"
fi
echo ""
