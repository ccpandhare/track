# Security Analysis: Allowlist-Based Access Control

## Current Implementation

The application uses an allowlist (`allowlist.json`) to control who can register. However, there are several security gaps.

## Vulnerabilities

### 🔴 CRITICAL: Allowlist Only Checked at Registration

**Issue:** The allowlist is only checked during `/register/start`. Once a user is registered in the database, they can login even if removed from the allowlist.

**Attack Vector:**
1. User added to allowlist temporarily
2. User registers successfully
3. User removed from allowlist
4. User can still login indefinitely

**Current Code:**
```javascript
// Registration checks allowlist ✅
authRouter.post('/register/start', (req, res) => {
  if (!allowedUsers.has(username)) {
    return res.status(403).json({ error: 'Registration is invite-only...' });
  }
  // ... continue registration
});

// Login does NOT check allowlist ❌
authRouter.post('/login/start', (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  // No allowlist check here!
});
```

**Fix Required:** Check allowlist on EVERY login attempt.

---

### 🟡 MEDIUM: No User Revocation Mechanism

**Issue:** No way to revoke access for already-registered users without manually deleting from database.

**Attack Vector:**
- Compromised account cannot be quickly disabled
- Former employees/contractors retain access
- No audit trail of revocations

**Fix Required:** Add active/inactive flag in database, check on login.

---

### 🟡 MEDIUM: No Rate Limiting

**Issue:** No protection against brute-force or DoS attacks.

**Attack Vectors:**
1. **Username Enumeration:** Attacker can brute-force usernames to discover allowlist members
2. **API Abuse:** Unlimited calls to FlightRadar24 API
3. **DoS:** Overwhelming the server with requests

**Fix Required:** Add rate limiting middleware.

---

### 🟡 MEDIUM: Sessions Never Invalidated

**Issue:** 30-day sessions with no central invalidation mechanism.

**Attack Vector:**
- Stolen session tokens remain valid for 30 days
- No way to force logout all sessions
- User removed from allowlist can use existing session

**Fix Required:** Implement session invalidation on allowlist removal.

---

### 🟢 LOW: Allowlist File Permissions

**Issue:** `allowlist.json` is readable by www-data user (backend process).

**Current State:** Required for application to work.

**Risk:** If application is compromised, attacker can read allowlist.

**Mitigation:** This is acceptable as the backend needs read access. Ensure file is:
- Not committed to git ✅
- Only readable by www-data ✅
- Backed up securely

---

## Recommended Security Enhancements

### 1. Enforce Allowlist on Login (CRITICAL)

Check allowlist every time user attempts to login:

```javascript
authRouter.post('/login/start', (req, res) => {
  const { username } = req.body;

  // NEW: Check allowlist before allowing login
  if (!allowedUsers.has(username)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // ... continue login
});
```

### 2. Enforce Allowlist on Session Validation (CRITICAL)

Check allowlist when validating sessions:

```javascript
export function authenticateUser(req, res, next) {
  // ... get session from DB

  // NEW: Check if user is still in allowlist
  if (!allowedUsers.has(session.username)) {
    // Delete session and deny access
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return res.status(403).json({ error: 'Access revoked' });
  }

  // ... continue
}
```

### 3. Add User Status Flag in Database

Add `active` field to users table:

```sql
ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1;
```

Then check on login:
```javascript
const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
```

### 4. Add Rate Limiting

Use `express-rate-limit`:

```javascript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many attempts, please try again later'
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

### 5. Hot-Reload Allowlist

Currently allowlist is only loaded on server start. Add file watcher:

```javascript
import { watch } from 'fs';

watch('./allowlist.json', (eventType) => {
  if (eventType === 'change') {
    allowedUsers = loadAllowlist();
    console.log('Allowlist reloaded');
  }
});
```

### 6. Add Audit Logging

Log all authentication events:

```javascript
function auditLog(event, username, success) {
  console.log(`[AUDIT] ${new Date().toISOString()} - ${event} - ${username} - ${success ? 'SUCCESS' : 'FAIL'}`);
}

// Usage
auditLog('LOGIN_ATTEMPT', username, true);
auditLog('REGISTRATION_BLOCKED', username, false);
```

---

## Security Best Practices Checklist

### Currently Implemented ✅
- [x] HTTPS enforced
- [x] API key server-side only
- [x] Passkey authentication (phishing-resistant)
- [x] Allowlist not committed to git
- [x] Session-based authentication
- [x] CORS configured

### Needs Implementation ⚠️
- [ ] Allowlist checked on login
- [ ] Allowlist checked on session validation
- [ ] Rate limiting
- [ ] User revocation mechanism
- [ ] Audit logging
- [ ] Hot-reload allowlist
- [ ] Session invalidation on revocation

---

## Threat Model

### Who are we protecting against?

1. **Unauthorized Public Access**
   - Status: ✅ Protected (allowlist + registration)
   - Risk: LOW

2. **Former Authorized Users**
   - Status: ⚠️ VULNERABLE (can still login after removal)
   - Risk: HIGH

3. **Brute Force Attacks**
   - Status: ⚠️ VULNERABLE (no rate limiting)
   - Risk: MEDIUM

4. **API Abuse**
   - Status: ⚠️ VULNERABLE (no rate limiting)
   - Risk: MEDIUM

5. **Compromised Sessions**
   - Status: ⚠️ VULNERABLE (no invalidation mechanism)
   - Risk: MEDIUM

---

## Recommended Immediate Actions

1. **Implement allowlist check on login** (5 minutes) - CRITICAL
2. **Implement allowlist check on session validation** (5 minutes) - CRITICAL
3. **Add rate limiting** (10 minutes) - HIGH
4. **Add audit logging** (10 minutes) - MEDIUM
5. **Add allowlist hot-reload** (5 minutes) - MEDIUM

Total time to fix critical issues: ~35 minutes
