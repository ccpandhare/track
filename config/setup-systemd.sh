#!/bin/bash

# Setup systemd service for the backend
# Run this script as root or with sudo

set -e

echo "Setting up systemd service for flight tracker backend..."

# Copy service file
echo "Copying service file..."
cp /var/www/track/config/systemd-backend.service /etc/systemd/system/flight-tracker.service

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

# Enable service to start on boot
echo "Enabling service..."
systemctl enable flight-tracker.service

echo ""
echo "Systemd service is configured!"
echo ""
echo "To manage the service:"
echo "  Start:   sudo systemctl start flight-tracker"
echo "  Stop:    sudo systemctl stop flight-tracker"
echo "  Restart: sudo systemctl restart flight-tracker"
echo "  Status:  sudo systemctl status flight-tracker"
echo "  Logs:    sudo journalctl -u flight-tracker -f"
echo ""
