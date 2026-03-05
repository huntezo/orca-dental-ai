# Incident Response Runbook

## Overview

This runbook provides procedures for handling security incidents, outages, and other critical issues.

## Severity Levels

| Level | Description | Examples | Response Time |
|-------|-------------|----------|---------------|
| **P0 - Critical** | Complete outage, data breach | Site down, unauthorized access | 15 minutes |
| **P1 - High** | Major feature broken, data at risk | Login broken, analysis failing | 1 hour |
| **P2 - Medium** | Partial degradation | Slow performance, minor bugs | 4 hours |
| **P3 - Low** | Cosmetic issues | Typos, UI glitches | 24 hours |

## Incident Response Team

| Role | Responsibility | Contact |
|------|---------------|---------|
| **Incident Commander** | Overall coordination | On-call engineer |
| **Technical Lead** | Technical decisions | [Tech Lead] |
| **Communications** | External communications | [PM/Comms] |
| **Security Lead** | Security assessment | [Security Engineer] |

## Response Procedures

### P0 - Critical Incident

#### 1. Detect (0-5 minutes)

**Monitoring Alerts:**
- PagerDuty/Opsgenie alert
- Health check failing (`/api/health`)
- Sentry error spike
- User reports

**Initial Assessment:**
```bash
# Check system health
curl https://beta.orcadental.ai/api/health

# Check error rates
# View Sentry dashboard
```

#### 2. Respond (5-15 minutes)

**Immediate Actions:**
1. **Acknowledge** incident in alerting system
2. **Create** incident channel (Slack: #incident-YYYY-MM-DD)
3. **Assess** scope:
   - Is it a complete outage?
   - Is user data at risk?
   - Is it a security breach?

**If Security Breach Suspected:**
1. Preserve evidence (don't delete logs)
2. Isolate affected systems
3. Notify Security Lead immediately
4. Document everything

#### 3. Mitigate (15-60 minutes)

**Common Mitigations:**

**Site Down:**
```bash
# Check Vercel status
vercel --version

# Rollback to last known good
vercel --target=production

# Or redeploy previous version
vercel --target=production --force
```

**Database Issues:**
```bash
# Check Supabase status
# Via Supabase Dashboard > Database > Logs

# If needed, scale up
# Via Supabase Dashboard > Database > Settings
```

**Edge Function Issues:**
```bash
# Redeploy edge functions
supabase functions deploy --project-ref=<ref>

# Check function logs
supabase functions logs process-analysis --tail
```

#### 4. Communicate (Ongoing)

**Internal (Slack #incidents):**
```
INCIDENT ALERT [P0]
Time: 2024-01-XX XX:XX UTC
Issue: [Brief description]
Impact: [Who/what is affected]
Status: Investigating
IC: [Name]
```

**External (if needed):**
- Status page update
- Email to affected users
- Social media (if widespread)

#### 5. Resolve (Varies)

**Verification:**
```bash
# Verify fix
curl https://beta.orcadental.ai/api/health

# Monitor for 30 minutes
# Watch Sentry for new errors
```

**Closeout:**
1. Verify all systems stable
2. Send all-clear notification
3. Schedule post-mortem within 24 hours

---

### Security Incident Response

#### Suspected Data Breach

**Immediate (First 15 minutes):**
1. **STOP** - Don't panic, don't delete anything
2. **ISOLATE** - Disable affected accounts/systems
3. **PRESERVE** - Save all logs and evidence
4. **NOTIFY** - Security Lead + Legal (if required)

**Investigation (15-60 minutes):**
```sql
-- Check access logs for suspicious activity
SELECT * FROM access_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check audit logs
SELECT * FROM audit_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check for new admin users
SELECT * FROM profiles 
WHERE role = 'admin' 
AND created_at > NOW() - INTERVAL '24 hours';
```

**Containment:**
1. Reset passwords for affected accounts
2. Revoke suspicious sessions
3. Enable additional logging
4. Consider temporary shutdown if needed

**Notification (if required by law):**
- Legal counsel
- Affected users within 72 hours (GDPR)
- Regulatory authorities if required

---

## Common Incidents

### 1. Registration Not Working

**Symptoms:** Users can't sign up

**Diagnosis:**
```bash
# Check beta allowlist
# Verify NEXT_PUBLIC_BETA_MODE setting

# Check Edge Function logs
supabase functions logs beta-check --tail
```

**Fix:**
- If allowlist issue: Add user manually
- If function issue: Redeploy beta-check
- If config issue: Update environment variables

### 2. AI Analysis Stuck

**Symptoms:** Analysis shows "processing" for hours

**Diagnosis:**
```sql
-- Check worker status
SELECT 
  status, 
  COUNT(*),
  MAX(created_at) as latest
FROM ai_jobs 
GROUP BY status;

-- Check failed jobs
SELECT * FROM ai_jobs 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 10;
```

**Fix:**
1. Check worker logs
2. Restart worker if needed
3. Manually retry failed jobs if appropriate

### 3. File Upload Failing

**Symptoms:** Users can't upload images

**Diagnosis:**
```bash
# Check storage bucket
curl https://<project>.supabase.co/storage/v1/bucket/case-files

# Check RLS policies
# Via Supabase Dashboard > Storage > Policies
```

**Fix:**
- Check storage bucket permissions
- Verify CORS settings
- Check file size limits

### 4. Database Connection Issues

**Symptoms:** 500 errors, "connection refused"

**Diagnosis:**
```bash
# Check Supabase status
# Via Supabase Dashboard > Database > Logs

# Check connection pool
# Via Supabase Dashboard > Database > Pooling
```

**Fix:**
- Restart database (via Supabase Dashboard)
- Scale up if needed
- Check for connection leaks in application

---

## Post-Incident Review

### Template

```markdown
# Post-Incident Review: [INCIDENT-ID]

## Summary
- **Date:** YYYY-MM-DD
- **Duration:** XX minutes
- **Severity:** P0/P1/P2/P3
- **Impact:** [Who was affected]

## Timeline
- XX:XX - Issue detected
- XX:XX - Response started
- XX:XX - Issue mitigated
- XX:XX - Fully resolved

## Root Cause
[What caused the issue]

## Resolution
[How it was fixed]

## Lessons Learned
- [What went well]
- [What could be improved]

## Action Items
- [ ] Fix X
- [ ] Improve monitoring for Y
- [ ] Document Z

## Owner
[Name]
```

### Meeting

Schedule within 24 hours of resolution:
- 30 minutes maximum
- Focus on learning, not blame
- Assign action items with owners
- Update runbooks if needed

---

## Escalation Path

```
On-Call Engineer (15 min)
    ↓
Tech Lead (30 min)
    ↓
Engineering Manager (1 hour)
    ↓
CTO/Executive (if needed)
```

## Contact Information

| Service | Contact | Notes |
|---------|---------|-------|
| Supabase Support | support@supabase.io | 24/7 for paid plans |
| Vercel Support | Support portal | Business plan |
| Sentry Support | support@sentry.io | Enterprise plan |
| On-Call Engineer | PagerDuty/Opsgenie | Primary |
| Tech Lead | [Phone/Email] | Escalation |

## Resources

- [Health Endpoint](https://beta.orcadental.ai/api/health)
- [Sentry Dashboard](https://sentry.io/orgs/orca-dental-ai)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Supabase Dashboard](https://app.supabase.com)
- [Status Page](https://status.orcadental.ai) (if available)

---

**Last Updated:** 2024-01
**Review Schedule:** Quarterly
**Owner:** DevOps Team
