# Environment Strategy

## Overview

Orca Dental AI uses a three-environment strategy to ensure safe development, testing, and production deployment.

| Environment | Purpose | URL | Supabase Project | Status |
|-------------|---------|-----|------------------|--------|
| **dev** | Local development | `http://localhost:3000` | Local or dev project | Active |
| **staging** | Private beta testing | `https://beta.orcadental.ai` | Staging project | **Current** |
| **production** | Live customer usage | `https://orcadental.ai` | Production project | Future |

---

## Environment Details

### Development (dev)

**Purpose:** Local development and feature testing

**Configuration:**
- **Domain:** `localhost:3000`
- **Supabase:** Local Docker or dev project
- **Edge Functions:** Local `supabase functions serve`
- **Sentry:** Disabled or uses dev DSN
- **Database:** Local PostgreSQL or dev Supabase
- **Storage:** Local or dev bucket

**Usage:**
```bash
# Start local dev server
npm run dev

# Start local Supabase
supabase start
```

**Environment Variables:**
```env
NEXT_PUBLIC_ENV=dev
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
```

---

### Staging (Private Beta)

**Purpose:** Private beta with 10-30 doctors

**Configuration:**
- **Domain:** `https://beta.orcadental.ai`
- **Supabase:** Separate staging project
- **Edge Functions:** Deployed to staging project
- **Sentry:** Staging DSN with 100% sampling
- **Database:** Isolated staging database
- **Storage:** Isolated staging bucket
- **Features:** Beta allowlist enabled

**Usage:**
```bash
# Deploy to staging
vercel --target=staging
supabase functions deploy --project-ref=<staging-ref>
```

**Environment Variables:**
```env
NEXT_PUBLIC_ENV=staging
NEXT_PUBLIC_APP_URL=https://beta.orcadental.ai
NEXT_PUBLIC_SUPABASE_URL=https://<staging>.supabase.co
NEXT_PUBLIC_BETA_MODE=true
NEXT_PUBLIC_ENABLE_ADMIN=true
```

**Beta Features:**
- Email allowlist for registration
- Admin dashboard enabled
- Full audit logging
- Enhanced monitoring

---

### Production

**Purpose:** Live customer usage (post-beta)

**Configuration:**
- **Domain:** `https://orcadental.ai`
- **Supabase:** Production project
- **Edge Functions:** Deployed to production
- **Sentry:** Production DSN with 10% sampling
- **Database:** Production database with backups
- **Storage:** Production bucket with replication
- **Features:** All stable features

**Usage:**
```bash
# Deploy to production (requires approval)
vercel --target=production
supabase functions deploy --project-ref=<prod-ref>
```

**Environment Variables:**
```env
NEXT_PUBLIC_ENV=prod
NEXT_PUBLIC_APP_URL=https://orcadental.ai
NEXT_PUBLIC_SUPABASE_URL=https://<prod>.supabase.co
NEXT_PUBLIC_BETA_MODE=false
NEXT_PUBLIC_ENABLE_ADMIN=true
```

---

## Naming Conventions

### Branches

| Branch | Purpose | CI/CD |
|--------|---------|-------|
| `main` | Production-ready code | Deploys to production |
| `staging` | Beta testing | Deploys to staging |
| `feature/*` | Feature development | PR checks only |
| `hotfix/*` | Critical fixes | Fast-track to production |

### Database Migrations

```
infra/db/migrations/
  001_initial.sql
  002_cases_and_storage.sql
  ...
  009_beta_allowlist.sql
```

- Sequential numbering (001, 002, ...)
- Descriptive names
- One migration per feature/schema change

### Edge Functions

```
supabase/functions/
  process-analysis/
  beta-check/
  health-check/
```

- Kebab-case names
- One function per logical operation
- Include README in each function folder

### Environment Variables

**Prefix conventions:**
- `NEXT_PUBLIC_*` - Available in browser
- `SENTRY_*` - Server-side only
- `SUPABASE_*` - Service role (server only)

**Required Variables by Environment:**

| Variable | dev | staging | prod |
|----------|-----|---------|------|
| `NEXT_PUBLIC_ENV` | dev | staging | prod |
| `NEXT_PUBLIC_APP_URL` | localhost | beta.orcadental.ai | orcadental.ai |
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Required | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Required | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Required | Required |
| `SENTRY_DSN` | Optional | Required | Required |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Required | Required |
| `NEXT_PUBLIC_BETA_MODE` | false | true | false |
| `NEXT_PUBLIC_ENABLE_ADMIN` | true | true | true |

---

## Deployment Flow

```
Feature Branch → PR → staging branch → beta.orcadental.ai
                                     ↓
main branch ← PR approval ← staging validation
  ↓
orcadental.ai (production)
```

### Staging Deployment (Beta)

1. Merge feature branch to `staging`
2. GitHub Actions runs tests
3. Vercel auto-deploys to `beta.orcadental.ai`
4. Run smoke tests
5. Notify beta users

### Production Deployment

1. Create PR from `staging` to `main`
2. Require 2 approvals
3. Run full test suite
4. Deploy to production
5. Monitor for 30 minutes
6. Rollback plan ready

---

## Data Isolation

| Data Type | dev | staging | production |
|-----------|-----|---------|------------|
| User accounts | Local/mock | Real (beta doctors) | Real (customers) |
| Case data | Test data | Real beta cases | Real patient data |
| Analytics | Disabled | Enabled | Enabled |
| Audit logs | Console | Database | Database + Archive |
| Backups | None | Daily | Daily + PITR |

---

## Security Differences

| Aspect | dev | staging | production |
|--------|-----|---------|------------|
| Authentication | Relaxed | Strict | Strict |
| Rate limiting | Disabled | Enabled | Enabled |
| CORS | Permissive | Strict | Strict |
| Sentry sampling | 100% | 100% | 10% |
| Signed URL expiry | 60 min | 10 min | 10 min |
| Admin access | All users | Admin role only | Admin role only |

---

## Monitoring

| Tool | dev | staging | production |
|------|-----|---------|------------|
| Sentry | Optional | Enabled | Enabled |
| Vercel Analytics | Disabled | Enabled | Enabled |
| Supabase Dashboard | Local | Enabled | Enabled |
| Custom /api/health | Console | Enabled | Enabled |
| Uptime monitoring | No | Yes | Yes |

---

## Private Beta (Current Status)

**We are currently in PRIVATE BETA using the staging environment.**

### Beta Configuration

- **Environment:** staging
- **URL:** https://beta.orcadental.ai
- **Users:** 10-30 invited doctors
- **Features:**
  - Email allowlist enforced
  - Full admin dashboard
  - Audit logging active
  - Daily backups
  - Enhanced monitoring

### Beta Exit Criteria

- [ ] 30+ successful case analyses
- [ ] Zero critical bugs for 2 weeks
- [ ] All beta doctors satisfied
- [ ] Performance metrics acceptable
- [ ] Security audit passed

---

## Quick Reference

### Switching Environments

```bash
# Local development
npm run dev

# Deploy to staging
vercel --target=staging

# Deploy to production
vercel --target=production
```

### Database Migrations

```bash
# Local
supabase db reset

# Staging
supabase db push --project-ref=<staging-ref>

# Production
supabase db push --project-ref=<prod-ref>
```

### Environment Validation

```bash
# Check environment config
node scripts/validate-env.js

# Run health check
curl https://beta.orcadental.ai/api/health
```

---

**Last Updated:** 2024
**Next Review:** Post-beta launch
