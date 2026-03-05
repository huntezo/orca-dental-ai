# Beta Onboarding Runbook

## Overview

This runbook describes how to invite a new doctor to the private beta.

## Prerequisites

- Admin access to Orca Dental AI
- Doctor's email address
- Optional: Doctor's name/clinic for notes

## Steps

### 1. Add Email to Allowlist

**Via Admin Dashboard:**
1. Navigate to `https://beta.orcadental.ai/admin/beta`
2. Click "Add Email"
3. Enter doctor's email
4. Add optional note (e.g., "Dr. Smith from Dental Clinic")
5. Click "Add to Allowlist"

**Via SQL (if needed):**
```sql
SELECT add_to_beta_allowlist('doctor@example.com', 'Dr. Smith from Dental Clinic');
```

### 2. Send Invitation Email

**Template:**
```
Subject: You're Invited to Orca Dental AI Private Beta

Dear Dr. [Name],

You've been invited to participate in the private beta of Orca Dental AI, 
our AI-powered dental analysis platform.

**Getting Started:**
1. Visit: https://beta.orcadental.ai
2. Click "Register"
3. Use this email address: [doctor@example.com]
4. Create your account

**What's Included:**
- AI-powered cephalometric analysis
- Automatic measurements and classifications
- PDF report generation
- Secure cloud storage

**Feedback:**
We'd love your feedback! Please share any issues or suggestions 
via email: beta-feedback@orcadental.ai

**Support:**
For technical issues, contact: support@orcadental.ai

Welcome to the future of dental analysis!

Best regards,
The Orca Dental AI Team
```

### 3. Verify Invitation

Check that the email appears in the allowlist:

**Via Admin Dashboard:**
- Navigate to `/admin/beta`
- Confirm email appears in the list
- Status should show "Not Registered"

**Via SQL:**
```sql
SELECT * FROM beta_allowlist WHERE email = 'doctor@example.com';
```

### 4. Monitor Registration

Once the doctor registers:

**Via Admin Dashboard:**
- Status will change to "Registered"
- Shows registration date and user ID

**Via SQL:**
```sql
SELECT 
  email, 
  registered_at, 
  registered_user_id 
FROM beta_allowlist 
WHERE email = 'doctor@example.com';
```

### 5. Post-Registration

After the doctor registers:

1. **Welcome Email:** Send welcome email with quick start guide
2. **Onboarding Call:** Schedule optional onboarding call
3. **Check-in:** Follow up after 1 week for feedback
4. **Support:** Monitor for any support requests

## Troubleshooting

### Issue: Email Already Registered

**Symptom:** Doctor says they already have an account

**Solution:**
1. Check if email is already in `auth.users`
2. If yes, they should use "Sign In" not "Register"
3. If they forgot password, use "Forgot Password"

### Issue: Registration Fails

**Symptom:** Doctor can't register, sees "not on allowlist"

**Solution:**
1. Verify email is in allowlist (case-insensitive)
2. Check for typos in email address
3. Ensure `NEXT_PUBLIC_BETA_MODE=true` is set
4. Check Edge Function logs for errors

### Issue: Allowlist Not Working

**Symptom:** Anyone can register, allowlist not enforced

**Solution:**
1. Verify `NEXT_PUBLIC_BETA_MODE=true` in environment
2. Check that beta-check Edge Function is deployed
3. Verify RLS policies on `beta_allowlist` table

## Beta Limits

- **Total Beta Slots:** 30 doctors
- **Current Count:** Check `/admin/beta` dashboard
- **Remaining:** Displayed in admin dashboard

## Metrics to Track

| Metric | Target | Check Command |
|--------|--------|---------------|
| Invitations Sent | 30 | `SELECT COUNT(*) FROM beta_allowlist;` |
| Registered Users | 25+ | `SELECT COUNT(*) FROM beta_allowlist WHERE registered_user_id IS NOT NULL;` |
| Active Users (7d) | 20+ | Check analytics dashboard |
| Cases Created | 50+ | `SELECT COUNT(*) FROM cases;` |

## Communication Templates

### Follow-up (1 week after registration)

```
Subject: How is your Orca Dental AI experience?

Hi Dr. [Name],

You've been using Orca Dental AI for a week now. 
We'd love to hear about your experience!

**Quick Questions:**
1. How was the onboarding process?
2. Have you uploaded any cases?
3. Any issues or feedback?

**Need Help?**
- Documentation: [link]
- Support: support@orcadental.ai

Thanks for being part of our beta!

Best,
[Your Name]
```

### Beta End Notification

```
Subject: Orca Dental AI - Beta Program Ending

Dear Beta Participant,

Thank you for participating in our private beta program!

**Important Dates:**
- Beta Ends: [Date]
- Production Launch: [Date]
- Your Data: Will be migrated to production

**Next Steps:**
1. Save any reports you need
2. Update your bookmarks to: https://orcadental.ai
3. Your login credentials will remain the same

**Questions?**
Contact: beta@orcadental.ai

Thank you for helping us build the future of dental AI!
```

## Contacts

| Role | Name | Email | Slack |
|------|------|-------|-------|
| Beta Lead | [Name] | beta@orcadental.ai | #beta-support |
| Technical Lead | [Name] | tech@orcadental.ai | #tech-support |
| Product Manager | [Name] | product@orcadental.ai | #product |

## References

- [Environment Setup](../environments.md)
- [Database Migrations](./database-migrations.md)
- [Incident Response](./incident-response.md)

---

**Last Updated:** 2024-01
**Next Review:** Weekly during beta
