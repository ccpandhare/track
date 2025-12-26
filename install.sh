#!/bin/bash

# Flight Tracker Installation Script
# This script helps you set up the application quickly

set -e

echo "================================"
echo "Flight Tracker Installation"
echo "================================"
echo ""

# Check if running as root for production install
if [ "$EUID" -eq 0 ]; then
    PRODUCTION=true
    echo "Running as root - Production installation mode"
else
    PRODUCTION=false
    echo "Running as user - Development installation mode"
fi

echo ""

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install
echo "✓ Backend dependencies installed"
echo ""

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd ../frontend
npm install
echo "✓ Frontend dependencies installed"
echo ""

# Setup environment file
cd ../backend
if [ ! -f .env ]; then
    echo "Setting up .env file..."
    cp .env.example .env
    echo "✓ Created .env file from template"
    echo ""
    echo "⚠️  IMPORTANT: Edit backend/.env and add your FlightRadar24 API key!"
    echo ""
else
    echo "✓ .env file already exists"
    echo ""
fi

# Setup allowlist
if [ ! -f allowlist.json ]; then
    echo "Setting up user allowlist..."
    cp allowlist.example.json allowlist.json
    echo "✓ Created allowlist.json from template"
    echo ""
    echo "⚠️  IMPORTANT: Edit backend/allowlist.json to add approved usernames!"
    echo ""
else
    echo "✓ allowlist.json already exists"
    echo ""
fi

cd ..

# Production-specific setup
if [ "$PRODUCTION" = true ]; then
    echo "================================"
    echo "Production Setup"
    echo "================================"
    echo ""

    # Build frontend
    echo "Building frontend..."
    cd frontend
    npm run build
    echo "✓ Frontend built successfully"
    echo ""
    cd ..

    # Setup systemd
    echo "Do you want to setup systemd service? (y/n)"
    read -r setup_systemd
    if [ "$setup_systemd" = "y" ]; then
        cd config
        ./setup-systemd.sh
        cd ..
    fi

    # Setup nginx
    echo "Do you want to setup nginx? (y/n)"
    read -r setup_nginx
    if [ "$setup_nginx" = "y" ]; then
        cd config
        ./setup-nginx.sh
        cd ..
    fi

    # Setup SSL
    echo "Do you want to setup SSL with certbot? (y/n)"
    read -r setup_ssl
    if [ "$setup_ssl" = "y" ]; then
        echo "⚠️  Make sure DNS is pointing to this server first!"
        echo "Continue? (y/n)"
        read -r continue_ssl
        if [ "$continue_ssl" = "y" ]; then
            cd config
            ./setup-ssl.sh
            cd ..
        fi
    fi

    echo ""
    echo "================================"
    echo "Production Installation Complete"
    echo "================================"
    echo ""
    echo "Next steps:"
    echo "1. Edit backend/.env with your API key"
    echo "2. Edit backend/allowlist.json with approved usernames"
    echo "3. Start the service: sudo systemctl start flight-tracker"
    echo "4. Visit https://track.chinmaypandhare.uk"
    echo ""

else
    echo "================================"
    echo "Development Installation Complete"
    echo "================================"
    echo ""
    echo "Next steps:"
    echo "1. Edit backend/.env with your API key (use localhost settings)"
    echo "2. Edit backend/allowlist.json with test usernames"
    echo "3. Start backend: cd backend && npm run dev"
    echo "4. Start frontend: cd frontend && npm run dev"
    echo "5. Visit http://localhost:5173"
    echo ""
fi

echo "For more information, see:"
echo "- QUICKSTART.md (development)"
echo "- DEPLOYMENT.md (production)"
echo "- PROJECT_SUMMARY.md (overview)"
echo ""
