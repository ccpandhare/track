// Audit logging utility for security events

export function auditLog(event, username, success, details = {}) {
  const timestamp = new Date().toISOString();
  const status = success ? 'SUCCESS' : 'FAIL';
  const detailsStr = Object.keys(details).length > 0 ? JSON.stringify(details) : '';

  console.log(`[AUDIT] ${timestamp} | ${event} | ${username} | ${status} ${detailsStr}`);
}

// Export common audit event types
export const AuditEvents = {
  REGISTRATION_ATTEMPT: 'REGISTRATION_ATTEMPT',
  REGISTRATION_BLOCKED: 'REGISTRATION_BLOCKED',
  REGISTRATION_SUCCESS: 'REGISTRATION_SUCCESS',
  LOGIN_ATTEMPT: 'LOGIN_ATTEMPT',
  LOGIN_BLOCKED: 'LOGIN_BLOCKED',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  SESSION_REVOKED: 'SESSION_REVOKED',
  ACCESS_DENIED: 'ACCESS_DENIED',
  LOGOUT: 'LOGOUT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};
