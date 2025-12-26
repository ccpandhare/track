#!/bin/bash

# Setup script for nginx configuration
# Run this script as root or with sudo

set -e

echo "Setting up nginx configuration for track.chinmaypandhare.uk..."

# Copy nginx configuration
echo "Copying nginx configuration..."
cp /var/www/track/config/nginx-track.conf /etc/nginx/sites-available/track.chinmaypandhare.uk

# Create symlink to enable site
echo "Enabling site..."
ln -sf /etc/nginx/sites-available/track.chinmaypandhare.uk /etc/nginx/sites-enabled/

# Test nginx configuration
echo "Testing nginx configuration..."
nginx -t

echo ""
echo "Nginx configuration is ready!"
echo ""
echo "Next steps:"
echo "1. Make sure DNS is pointing track.chinmaypandhare.uk to this server"
echo "2. Reload nginx: sudo systemctl reload nginx"
echo "3. Run certbot to get SSL certificate:"
echo "   sudo certbot --nginx -d track.chinmaypandhare.uk"
echo ""
