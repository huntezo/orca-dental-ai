# Edge Function Deployment Runbook

## Overview

This runbook describes how to deploy and manage Supabase Edge Functions for Orca Dental AI.

## Prerequisites

- Supabase CLI installed: `npm install -g supabase`
- Authenticated: `supabase login`
- Project linked: `supabase link --project-ref <ref>`

## Environments

| Environment | Project Ref | URL |
|-------------|-------------|-----|
| Dev | local | `http://localhost:54321/functions/v1` |
| Staging | `staging-ref` | `https://<staging>.supabase.co/functions/v1` |
| Production | `prod-ref` | `https://<prod>.supabase.co/functions/v1` |

---

## Local Development

### Start Local Functions

```bash
# Start Supabase locally
supabase start

# Serve functions with hot reload
supabase functions serve

# Serve specific function
supabase functions serve process-analysis
```

### Test Locally

```bash
# Test with curl
curl -X POST http://localhost:54321/functions/v1/beta-check \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Function Structure

```
supabase/functions/
├── process-analysis/
│   ├── index.ts
│   └── deno.json (optional)
├── beta-check/
│   └── index.ts
└── config.toml (function settings)
```

---

## Deployment

### Deploy Single Function

```bash
# Deploy to linked project
supabase functions deploy process-analysis

# Deploy with specific project
supabase functions deploy process-analysis --project-ref <ref>
```

### Deploy All Functions

```bash
# Deploy all functions
supabase functions deploy

# To specific project
supabase functions deploy --project-ref <ref>
```

### Staging Deployment

```bash
# Link to staging
supabase link --project-ref <staging-ref>

# Deploy all
supabase functions deploy

# Verify deployment
curl https://<staging>.supabase.co/functions/v1/health-check \
  -H "Authorization: Bearer <anon-key>"
```

### Production Deployment

⚠️ **Requires approval**

```bash
# Link to production
supabase link --project-ref <prod-ref>

# Deploy (requires confirmation)
supabase functions deploy

# Verify
curl https://<prod>.supabase.co/functions/v1/health-check \
  -H "Authorization: Bearer <anon-key>"
```

---

## Secrets Management

### Set Secrets

```bash
# Set a secret
supabase secrets set MY_SECRET=value

# Set multiple
supabase secrets set \
  SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz \
  STRIPE_KEY=sk_live_...

# From environment file
supabase secrets set --env-file .env.production
```

### List Secrets

```bash
supabase secrets list
```

### Unset Secrets

```bash
supabase secrets unset MY_SECRET
```

### Required Secrets per Environment

**All Functions:**
```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

**process-analysis:**
```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SENTRY_DSN
```

**beta-check:**
```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

---

## Monitoring & Logs

### View Logs

```bash
# Real-time logs
supabase functions logs process-analysis --tail

# Last 100 lines
supabase functions logs process-analysis -n 100

# Time range
supabase functions logs process-analysis --since "1 hour ago"
```

### Check Function Status

```bash
# List all functions
supabase functions list

# Check if healthy
curl -I https://<project>.supabase.co/functions/v1/health-check
```

---

## Rollback

### Quick Rollback

```bash
# Redeploy previous version from git
git checkout <previous-commit>
supabase functions deploy process-analysis
git checkout main
```

### Disable Function (Emergency)

```bash
# No direct disable, but can return 503
cat > supabase/functions/process-analysis/index.ts << 'EOF'
Deno.serve(() => new Response("Maintenance", { status: 503 }));
EOF

supabase functions deploy process-analysis
```

---

## Troubleshooting

### Issue: Function Not Found (404)

**Symptoms:** `Function not found` error

**Solutions:**
```bash
# Verify deployment
supabase functions list

# Redeploy
supabase functions deploy <function-name>

# Check project ref
supabase status
```

### Issue: Secrets Not Set

**Symptoms:** `Error: Missing environment variable`

**Solutions:**
```bash
# List current secrets
supabase secrets list

# Set missing secret
supabase secrets set MY_SECRET=value

# Verify in function code
console.log(Deno.env.get("MY_SECRET"));
```

### Issue: Cold Start Slow

**Symptoms:** First request is slow (> 5s)

**Solutions:**
- This is expected for Edge Functions
- Use connection pooling in Supabase client
- Minimize dependencies

### Issue: Timeout

**Symptoms:** `Function invocation timeout`

**Solutions:**
- Default timeout: 10 seconds
- Increase in `config.toml`:
```toml
[functions.process-analysis]
verify_jwt = true
import_map = "./import_map.json"
timeout = 30  # seconds
```

### Issue: Memory Limit

**Symptoms:** `Out of memory`

**Solutions:**
- Default: 256MB
- Reduce data processing
- Stream large responses

---

## Performance Optimization

### Connection Pooling

```typescript
// Use Supabase client with connection pooling
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false },
    db: { schema: "public" }
  }
);
```

### Minimize Cold Start

```typescript
// Lazy load heavy dependencies
let heavyModule: typeof import("heavy-module") | null = null;

async function getHeavyModule() {
  if (!heavyModule) {
    heavyModule = await import("heavy-module");
  }
  return heavyModule;
}
```

### Caching

```typescript
// Simple in-memory cache (per-instance)
const cache = new Map<string, any>();
const CACHE_TTL = 60 * 1000; // 1 minute

function getCached(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  return null;
}
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deploy-functions.yml
name: Deploy Edge Functions

on:
  push:
    branches: [staging, main]
    paths: ['supabase/functions/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Deploy to Staging
        if: github.ref == 'refs/heads/staging'
        run: |
          supabase link --project-ref ${{ secrets.STAGING_PROJECT_REF }}
          supabase functions deploy
          supabase secrets set --env-file .env.staging
      
      - name: Deploy to Production
        if: github.ref == 'refs/heads/main'
        run: |
          supabase link --project-ref ${{ secrets.PROD_PROJECT_REF }}
          supabase functions deploy
          supabase secrets set --env-file .env.production
```

---

## Security Checklist

- [ ] JWT verification enabled (`verify_jwt = true`)
- [ ] Service role key never logged
- [ ] Input validation on all endpoints
- [ ] Rate limiting implemented
- [ ] CORS configured correctly
- [ ] No hardcoded secrets
- [ ] Error messages don't leak sensitive info

---

## Function Registry

| Function | Purpose | Auth Required | Timeout |
|----------|---------|---------------|---------|
| `process-analysis` | Queue AI job | Yes | 10s |
| `beta-check` | Validate beta email | No | 5s |
| `health-check` | System health | No | 5s |

---

**Last Updated:** 2024-01
**Owner:** Backend Team
