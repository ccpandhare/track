# Security Fixes Summary

## Date: December 26, 2025
## Status: ✅ DEPLOYED

---

## Critical Vulnerabilities Fixed

### 1. ✅ Allowlist Bypass on Login (CRITICAL)

**Problem:** Users could login even after being removed from allowlist.

**Fix:** Added allowlist check to `/login/start` endpoint.

**Code:** [routes/auth.js:149-153](backend/routes/auth.js#L149-L153)
```javascript
// SECURITY: Check if username is still in allowlist
if (!allowedUsers.has(username)) {
  auditLog(AuditEvents.LOGIN_BLOCKED, username, false, { reason: 'not_in_allowlist' });
  return res.status(403).json({ error: 'Access denied. Account not authorized.' });
}
```

**Test:**
```bash
# Remove user from allowlist.json
# User CANNOT login ✅
```

---

### 2. ✅ Allowlist Bypass on API Access (CRITICAL)

**Problem:** Authenticated sessions could access APIs even after user removed from allowlist.

**Fix:** Added allowlist check to session validation middleware.

**Code:** [middleware/auth.js:48-54](backend/middleware/auth.js#L48-L54)
```javascript
// SECURITY: Check if user is still in allowlist
if (!allowedUsers.has(session.username)) {
  console.log(`[SECURITY] Session invalidated for removed user: ${session.username}`);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  return res.status(403).json({ error: 'Access revoked. Your account has been deactivated.' });
}
```

**Test:**
```bash
# User logged in with active session
# Remove user from allowlist.json
# Next API call -> 403 Forbidden + session deleted ✅
```

---

### 3. ✅ No Rate Limiting (MEDIUM)

**Problem:** No protection against brute-force attacks or API abuse.

**Fix:** Implemented rate limiting on auth and API endpoints.

**Code:** [server.js:15-33](backend/server.js#L15-L33)

**Auth Endpoints:** 5 attempts per 15 minutes
**API Endpoints:** 30 requests per minute

```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  handler: (req, res) => {
    console.log(`[SECURITY] Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many authentication attempts...' });
  }
});
```

**Test:**
```bash
# Make 6 login attempts in 15 minutes
# 6th attempt -> 429 Too Many Requests ✅
```

---

### 4. ✅ No Audit Logging (MEDIUM)

**Problem:** No visibility into security events.

**Fix:** Implemented comprehensive audit logging.

**Code:** [utils/audit.js](backend/utils/audit.js)

**Logged Events:**
- ✅ Registration attempts (success/blocked)
- ✅ Login attempts (success/blocked)
- ✅ Session revocations
- ✅ Logout events
- ✅ Rate limit violations

**Example Log:**
```
[AUDIT] 2025-12-26T07:49:00.000Z | LOGIN_SUCCESS | chinmay | SUCCESS
[AUDIT] 2025-12-26T07:49:30.000Z | LOGIN_BLOCKED | attacker | FAIL {"reason":"not_in_allowlist"}
[SECURITY] Session invalidated for removed user: bob
```

---

### 5. ✅ Manual Allowlist Reload (LOW)

**Problem:** Server restart required to reload allowlist changes.

**Fix:** Implemented hot-reload file watcher.

**Code:** [server.js:61-67](backend/server.js#L61-L67)
```javascript
watch('./allowlist.json', (eventType) => {
  if (eventType === 'change') {
    const authCount = reloadAuthAllowlist();
    reloadMiddlewareAllowlist();
    console.log(`[SECURITY] Allowlist hot-reloaded - ${authCount} users allowed`);
  }
});
```

**Test:**
```bash
# Edit allowlist.json
# Save file
# Backend logs: "[SECURITY] Allowlist hot-reloaded - 2 users allowed" ✅
# Changes effective immediately - no restart needed ✅
```

---

## Security Flow (After Fixes)

```
┌─────────────────┐
│  Register       │ → ✅ Checks allowlist
└─────────────────┘
        ↓
┌─────────────────┐
│  Login          │ → ✅ Checks allowlist + Rate limited
└─────────────────┘
        ↓
┌─────────────────┐
│  Every API Call │ → ✅ Checks allowlist + Rate limited
└─────────────────┘
        ↓
┌─────────────────┐
│  All Events     │ → ✅ Logged to audit trail
└─────────────────┘
```

---

## How to Revoke User Access

### Option 1: Remove from Allowlist (Recommended)

```bash
# 1. Edit allowlist
nano /var/www/track/backend/allowlist.json

# Remove username from array
# {
#   "allowedUsers": [
#     "chinmay"
#     // "bob" <- removed
#   ]
# }

# 2. Save file (auto-reloads, no restart needed)

# 3. User immediately loses access:
#    - Cannot login
#    - Existing sessions invalidated on next API call
#    - All access blocked
```

### Option 2: View Active Sessions

```bash
# Check who's logged in
sqlite3 /var/www/track/backend/users.db "
  SELECT u.username, s.created_at, s.expires_at
  FROM sessions s
  JOIN users u ON s.user_id = u.id
  WHERE s.expires_at > strftime('%s', 'now') * 1000
"
```

### Option 3: Force Logout All Sessions for User

```bash
# Manually delete sessions
sqlite3 /var/www/track/backend/users.db "
  DELETE FROM sessions
  WHERE user_id = (SELECT id FROM users WHERE username = 'bob')
"
```

---

## Monitoring Security Events

### View All Audit Logs
```bash
sudo journalctl -u flight-tracker | grep AUDIT
```

### View Security Events
```bash
sudo journalctl -u flight-tracker | grep SECURITY
```

### View Failed Login Attempts
```bash
sudo journalctl -u flight-tracker | grep "LOGIN_BLOCKED"
```

### View Rate Limit Violations
```bash
sudo journalctl -u flight-tracker | grep "Rate limit exceeded"
```

### Real-Time Security Monitoring
```bash
sudo journalctl -u flight-tracker -f | grep -E "AUDIT|SECURITY"
```

---

## Testing the Fixes

### Test 1: Allowlist Enforcement on Login

```bash
# 1. Add test user to allowlist
echo '{"allowedUsers":["chinmay","testuser"]}' > /var/www/track/backend/allowlist.json

# 2. User registers successfully (not shown, requires passkey)

# 3. Remove user from allowlist
echo '{"allowedUsers":["chinmay"]}' > /var/www/track/backend/allowlist.json

# 4. Try to login
curl -X POST https://track.chinmaypandhare.uk/api/auth/login/start \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}'

# Expected: 403 {"error":"Access denied. Account not authorized."}
# Logs: [AUDIT] ... | LOGIN_BLOCKED | testuser | FAIL {"reason":"not_in_allowlist"}
```

### Test 2: Session Invalidation

```bash
# 1. User "bob" logged in with active session

# 2. Remove bob from allowlist
echo '{"allowedUsers":["chinmay"]}' > /var/www/track/backend/allowlist.json

# 3. Bob tries to access API
curl https://track.chinmaypandhare.uk/api/flights/search?flightNumber=BA123 \
  -H "X-Session-Id: bobs-session-id"

# Expected: 403 {"error":"Access revoked. Your account has been deactivated."}
# Logs: [SECURITY] Session invalidated for removed user: bob
```

### Test 3: Rate Limiting

```bash
# Try 6 login attempts rapidly
for i in {1..6}; do
  curl -X POST https://track.chinmaypandhare.uk/api/auth/login/start \
    -H "Content-Type: application/json" \
    -d '{"username":"test"}'
  echo " - Attempt $i"
done

# Expected: First 5 succeed (or fail normally), 6th returns 429
# Logs: [SECURITY] Rate limit exceeded for IP: xxx.xxx.xxx.xxx
```

### Test 4: Hot-Reload

```bash
# 1. Check current allowlist count in logs
sudo journalctl -u flight-tracker -n 1 | grep "Allowlist hot-reload"

# 2. Edit allowlist
nano /var/www/track/backend/allowlist.json

# 3. Save and check logs
sudo journalctl -u flight-tracker -n 5 | grep "Allowlist"

# Expected: [SECURITY] Allowlist hot-reloaded - X users allowed
```

---

## Dependencies Added

```json
{
  "express-rate-limit": "^7.5.1"
}
```

---

## Files Modified

1. ✅ [backend/routes/auth.js](backend/routes/auth.js) - Added allowlist checks + audit logging
2. ✅ [backend/middleware/auth.js](backend/middleware/auth.js) - Added allowlist validation
3. ✅ [backend/server.js](backend/server.js) - Added rate limiting + hot-reload
4. ✅ [backend/utils/audit.js](backend/utils/audit.js) - New audit logging utility
5. ✅ [backend/package.json](backend/package.json) - Added express-rate-limit

---

## Deployment Status

- ✅ Code deployed to production
- ✅ Service restarted successfully
- ✅ All security features active
- ✅ Hot-reload enabled
- ✅ Audit logging operational

**Backend Status:**
```
● flight-tracker.service - Flight Tracker Backend
   Active: active (running)
   Logs: Server running on port 3000
         [SECURITY] Allowlist hot-reload enabled
```

---

## Security Checklist

- [x] Allowlist checked on registration
- [x] Allowlist checked on login
- [x] Allowlist checked on every API call
- [x] Rate limiting on auth endpoints (5/15min)
- [x] Rate limiting on API endpoints (30/min)
- [x] Audit logging for all security events
- [x] Hot-reload for allowlist changes
- [x] Session invalidation on revocation
- [x] HTTPS enforced
- [x] API keys server-side only
- [x] Passkey authentication (WebAuthn)

---

## Threat Mitigation Summary

| Threat | Before | After | Status |
|--------|--------|-------|--------|
| Unauthorized registration | 🟡 Blocked | 🟢 Blocked | ✅ |
| Removed user login | 🔴 **Allowed** | 🟢 Blocked | ✅ FIXED |
| Removed user API access | 🔴 **Allowed** | 🟢 Blocked | ✅ FIXED |
| Brute force attacks | 🔴 **No protection** | 🟢 Rate limited | ✅ FIXED |
| Username enumeration | 🔴 **Possible** | 🟡 Rate limited | ✅ MITIGATED |
| Session hijacking | 🟡 30-day validity | 🟢 Revocable | ✅ IMPROVED |
| Security visibility | 🔴 **No logging** | 🟢 Full audit trail | ✅ FIXED |

---

## Conclusion

All critical security vulnerabilities have been fixed and deployed. The allowlist now properly enforces access control at **every** point:

1. ✅ **Registration** - Blocked if not in allowlist
2. ✅ **Login** - Blocked if not in allowlist
3. ✅ **API Access** - Blocked if not in allowlist (sessions invalidated)
4. ✅ **Real-time** - Changes take effect immediately (hot-reload)
5. ✅ **Auditable** - All events logged

**The system is now truly invite-only and secure.**
