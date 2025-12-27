# Flight Tracker - Development Guide for Claude

This document provides architectural context and development guidelines for working on this codebase.

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend**: Vanilla JavaScript, Vite bundler, CSS3
- **Backend**: Node.js, Express.js
- **Database**: SQLite (better-sqlite3)
- **Authentication**: WebAuthn/FIDO2 (passkey-only)
- **External API**: FlightAware AeroAPI
- **Deployment**: Nginx reverse proxy, systemd, Let's Encrypt SSL

### Project Structure
```
track/
├── frontend/
│   ├── main.js              # Main entry point - UI logic, API calls, history management
│   ├── style.css            # All styles including flight cards, chips, animations
│   ├── index.html           # HTML template
│   └── dist/                # Build output (served by nginx)
├── backend/
│   ├── server.js            # Main entry point - Express app, routes, middleware
│   ├── users.db             # SQLite database (users, credentials, sessions, invite codes)
│   ├── allowlist.json       # User allowlist (hot-reloadable)
│   └── generate-invite.js   # Utility to generate invite codes
├── DEPLOYMENT_CHECKLIST.md  # Step-by-step deployment guide
├── DEPLOYMENT.md            # Detailed deployment documentation
└── README.md                # User-facing documentation
```

## 📍 Main Entry Points

### Frontend (`frontend/main.js`)
**Key sections:**
1. **Lines 1-114**: Configuration & airline code mapping (IATA ↔ ICAO)
2. **Lines 115-140**: DOM element references
3. **Lines 185-243**: Flight history management (save, get, delete)
4. **Lines 245-501**: UI display logic (history cards, chips, delete buttons)
5. **Lines 650-710**: Flight search handler (ICAO conversion, API calls)
6. **Lines 525-844**: Flight info display (details, delays, inbound aircraft)

**Important functions:**
- `saveFlightToHistory()` - Saves flight with date, timestamps, airport details
- `updateHistoryDisplay()` - Categorizes flights (ongoing/upcoming/completed) and renders UI
- `deleteFlightFromHistory()` - Removes flight from localStorage
- `convertToICAO()` - Converts IATA codes (6E) to ICAO (IGO) for FlightAware

### Backend (`backend/server.js`)
**Key sections:**
1. **Lines 1-50**: Dependencies, configuration, database setup
2. **Lines 51-100**: Middleware (CORS, rate limiting, session validation)
3. **Lines 101-200**: Authentication routes (register, login, logout)
4. **Lines 201-300**: Flight API routes (search, details, delay prediction)
5. **Lines 301-400**: Inbound flight tracking logic
6. **Lines 401-500**: Database helpers and allowlist hot-reload

**Important endpoints:**
- `POST /api/auth/register/start` & `/finish` - Passkey registration
- `POST /api/auth/login/start` & `/finish` - Passkey authentication
- `GET /api/flights/search` - Search flights by number and date
- `GET /api/flights/details/:id` - Get detailed flight info
- `GET /api/flights/delay-prediction/:id` - Predict delays using inbound aircraft

## 🎯 Architecture Principles

### 1. **Security First**
- Passkey-only authentication (no passwords)
- API keys stored server-side only (never exposed to frontend)
- Invite-only registration with allowlist
- Session-based auth with random IDs
- Rate limiting on all endpoints
- Comprehensive audit logging

### 2. **Data Flow**
```
User Input → Frontend (main.js)
    ↓
IATA→ICAO Conversion (if needed)
    ↓
API Request → Backend (server.js)
    ↓
FlightAware API Call
    ↓
Response Processing
    ↓
Frontend Display + localStorage
```

### 3. **State Management**
- **localStorage**: Flight history, session ID, remembered username
- **SQLite**: Users, passkey credentials, sessions, invite codes
- **In-memory**: Allowlist (reloaded on file change)

### 4. **UI Philosophy**
- Prioritize upcoming/ongoing flights over completed ones
- Show data staleness (time since last fetch)
- Visual hierarchy: expanded cards > chips
- Delete functionality with confirmation
- Auto-refresh after data changes

### 5. **Error Handling**
- Graceful fallbacks (ICAO → IATA if search fails)
- User-friendly error messages
- Console logging for debugging
- Try-catch blocks around API calls

## 📋 Deployment Checklist

**IMPORTANT:** See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for complete deployment steps.

### Quick Deploy Workflow

After making changes, **ALWAYS** follow these steps:

1. **Build Frontend:**
   ```bash
   cd /var/www/track/frontend
   npm run build
   ```

2. **Reload Nginx:**
   ```bash
   systemctl reload nginx
   ```

3. **Verify Deployment:**
   ```bash
   curl -s https://track.chinmaypandhare.uk/ | grep -o "index-[^.]*\.js"
   ```

4. **Commit Changes:**
   ```bash
   git add .
   git commit -m "Descriptive message"
   git push origin main
   ```

### Backend Changes
If backend code changed:
```bash
systemctl restart flight-tracker
systemctl status flight-tracker --no-pager
```

## 🔍 Common Development Tasks

### Adding New Features to Frontend
1. Update `frontend/main.js` with logic
2. Update `frontend/style.css` with styles
3. Build: `npm run build`
4. Test locally if possible
5. Deploy and verify

### Modifying Flight History Structure
1. Update `saveFlightToHistory()` to save new fields
2. Update `updateHistoryDisplay()` to use new fields
3. Consider backward compatibility for existing data
4. Test with existing localStorage data

### Adding New API Endpoints
1. Add route in `backend/server.js`
2. Add rate limiting if needed
3. Add audit logging
4. Test endpoint
5. Update frontend to call new endpoint
6. Restart backend service

### Updating Airline Code Mappings
1. Edit `AIRLINE_CODE_MAP` in `frontend/main.js` (lines 14-98)
2. Add both IATA and ICAO codes
3. Rebuild frontend
4. Test with that airline's flights

## 📊 Data Structures

### localStorage.flightHistory
```javascript
[
  {
    flightNumber: "6E1043",
    flightDate: "2025-12-27",           // Search date
    searchedAt: 1735318703000,          // When searched (ms)
    lastFetchedAt: 1735318703000,       // When last updated (ms)
    origin: "BOM",                      // IATA code
    destination: "DEL",
    originName: "Mumbai Airport",       // Full name
    destinationName: "Delhi Airport",
    status: "Scheduled",
    scheduledDeparture: 1735318740,     // Unix seconds
    scheduledArrival: 1735325940,
    estimatedDeparture: 1735319000,     // null if on-time
    estimatedArrival: 1735326000,
    actualDeparture: null,              // null until departed
    actualArrival: null                 // null until landed
  }
  // ... up to 20 flights
]
```

### SQLite Schema
- **users**: id, username, created_at
- **credentials**: user_id, credential_id, public_key, counter
- **sessions**: id, user_id, created_at
- **invite_codes**: code, username, created_at, used_at

## 🚨 Important Notes

1. **Always deploy after changes** - See checklist above
2. **Test ICAO conversion** - Many users enter IATA codes (6E vs IGO)
3. **Check backward compatibility** - Old localStorage data may lack new fields
4. **Monitor rate limits** - FlightAware API has rate limits
5. **Audit logs** - Check logs for security issues: `journalctl -u flight-tracker -f`
6. **SSL renewal** - Certbot auto-renews, but check: `sudo certbot certificates`

## 🔗 Useful Links

- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Step-by-step deployment guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment documentation
- [README.md](README.md) - User documentation
- [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Complete project overview
- [FlightAware AeroAPI Docs](https://www.flightaware.com/aeroapi/)

## 💡 Development Tips

- Frontend changes require build + nginx reload
- Backend changes require service restart
- Database changes are automatic (better-sqlite3)
- Allowlist changes are auto-reloaded (no restart needed)
- Use browser DevTools to inspect localStorage
- Check network tab for API call failures
- Console logs help debug ICAO conversion issues

---

**Remember:** After ANY change, build frontend and reload nginx. Then commit and push to GitHub!
