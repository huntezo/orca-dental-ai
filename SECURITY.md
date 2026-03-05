# Security & Compliance Documentation

## Overview

This document outlines the security measures and HIPAA-like compliance practices implemented in Orca Dental AI.

## Security Features

### Authentication & Authorization

- **Supabase Auth**: Secure, managed authentication
- **Role-Based Access Control**: `user` and `admin` roles
- **Row Level Security (RLS)**: Database-level access control
- **Account Lockout**: 5 failed attempts → 30-minute lockout
- **Session Management**: 24-hour sessions with secure cookies

### Data Protection

#### Encryption
| Layer | Method | Standard |
|-------|--------|----------|
| Database (at rest) | Supabase managed | AES-256 |
| Storage (at rest) | S3 server-side | AES-256 |
| Data in transit | TLS | 1.3 |
| Backups | Encrypted | AES-256 |

#### Data Minimization
- Only `patient_code` stored (no names, emails, phones)
- Validation prevents PII in patient codes
- Automatic sanitization of inputs

### Storage Security

#### Signed URLs
- **Expiry**: 10 minutes (down from 1 hour)
- **Access Logging**: All downloads logged
- **One-time use**: Recommended client-side enforcement

#### File Upload Security
- Type validation (images, PDFs only)
- Size limits (50MB max)
- Path traversal prevention
- Malware scanning hooks ready

### API Security

#### Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 60 | 1 minute |
| Login | 5 | 15 minutes |
| AI Analysis | 10 | 1 hour |
| File Upload | 5 | 1 minute |

#### CSRF Protection
- Double-submit cookie pattern
- Token rotation on sensitive operations
- Required for all state-changing requests

### Audit & Logging

#### Access Logs
- All file downloads tracked
- IP address and user agent logged
- 2-year retention (HIPAA requirement)

#### Audit Logs
- All data changes tracked
- Before/after values stored
- 7-year retention

#### Security Logs
- Failed login attempts
- Account lockouts
- Suspicious activity

## Compliance Checklist

### HIPAA-Like Best Practices

- [x] **Data Minimization**: No PII in patient codes
- [x] **Encryption at Rest**: AES-256 for all data
- [x] **Encryption in Transit**: TLS 1.3
- [x] **Access Controls**: RLS + RBAC
- [x] **Audit Logging**: All access tracked
- [x] **Account Lockout**: Brute force protection
- [x] **Backup & Recovery**: Daily backups, PITR
- [x] **Session Security**: Secure, httpOnly cookies
- [x] **Rate Limiting**: DDoS protection
- [x] **Input Validation**: XSS/SQL injection prevention

### Security Headers

All responses include:
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` (HSTS)
- `Permissions-Policy`

## Security Utilities

### Access Logging
```typescript
import { logFileDownload, logAccess } from '@/lib/security';

// Log file download
await logFileDownload({
  userId: user.id,
  fileId: file.id,
  caseId: caseId,
  fileType: 'image/jpeg',
  ipAddress: request.ip,
});
```

### CSRF Protection
```typescript
import { validateCsrfToken, fetchWithCsrf } from '@/lib/security';

// Server-side validation
const isValid = await validateCsrfToken(request);

// Client-side fetch
const response = await fetchWithCsrf('/api/cases', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

### Rate Limiting
```typescript
import { applyRateLimit, recordLoginAttempt } from '@/lib/security';

// Apply rate limit
const result = await applyRateLimit(request, { type: 'auth' });

// Record login attempt
const status = await recordLoginAttempt(email, ip, success);
```

### Storage Hardening
```typescript
import { generateHardenedSignedUrl } from '@/lib/security';

// Generate 10-minute signed URL with logging
const { url } = await generateHardenedSignedUrl({
  userId: user.id,
  fileId: file.storage_path,
  ipAddress: request.ip,
});
```

## Security Procedures

### Incident Response

1. **Detect**: Monitor logs for suspicious activity
2. **Contain**: Block IP, disable account if needed
3. **Investigate**: Review access logs
4. **Notify**: Inform affected users if data breach
5. **Recover**: Restore from backup if needed
6. **Document**: Post-incident report

### Security Updates

- **Dependencies**: Monthly `npm audit` and updates
- **Migration**: `infra/db/migrations/008_security.sql`
- **Configuration**: Environment variables for secrets
- **Review**: Quarterly security audit

## Penetration Testing Checklist

### Web Application
- [ ] SQL Injection (mitigated by RLS/parameterized queries)
- [ ] XSS (mitigated by CSP/React escaping)
- [ ] CSRF (mitigated by token validation)
- [ ] Authentication bypass
- [ ] Authorization bypass
- [ ] File upload vulnerabilities
- [ ] IDOR (Insecure Direct Object References)

### API Security
- [ ] Rate limiting effectiveness
- [ ] JWT validation
- [ ] Input validation
- [ ] Error information leakage
- [ ] CORS configuration

### Infrastructure
- [ ] SSL/TLS configuration
- [ ] Security headers
- [ ] DNS security
- [ ] DDoS resilience

## Vulnerability Disclosure

If you discover a security vulnerability, please report it to:
- Email: security@orcadental.ai
- Do not create public GitHub issues
- Allow 30 days for response

## Security Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Failed login attempts (24h) | < 100 | Monitor |
| Blocked requests (24h) | < 1000 | Monitor |
| Access log coverage | 100% | 100% |
| Encryption coverage | 100% | 100% |
| RLS enabled tables | 100% | 100% |

---

**Last Updated**: 2024-01
**Next Review**: Monthly
**Responsible**: Security Team
