# Database Migrations Runbook

## Overview

This runbook describes how to create, test, and apply database migrations for Orca Dental AI.

## Migration Strategy

We use **sequential numbered migrations** managed by Supabase CLI.

```
infra/db/migrations/
  001_initial.sql
  002_cases_and_storage.sql
  003_mock_ai.sql
  ...
  009_beta_allowlist.sql
```

## Principles

1. **Sequential**: Always increment number (001, 002, 003...)
2. **Idempotent**: Migrations can be run multiple times safely
3. **Reversible**: Include rollback when possible
4. **Tested**: Test on staging before production
5. **Documented**: Include comments explaining changes

---

## Creating a Migration

### 1. Create Migration File

```bash
# Option A: Using Supabase CLI
supabase migration new add_user_preferences

# Option B: Manual (preferred for complex migrations)
touch infra/db/migrations/010_user_preferences.sql
```

### 2. Write Migration

Template:
```sql
-- Migration 010: Add user preferences
-- Description: Add table for user notification preferences
-- Author: [Your Name]
-- Date: YYYY-MM-DD

-- ============================================
-- UP MIGRATION
-- ============================================

-- Create table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id ON user_preferences(user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE user_preferences IS 'User notification preferences';

-- ============================================
-- DOWN MIGRATION (for rollback)
-- ============================================
-- Uncomment to rollback:
-- DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS user_preferences;
```

### 3. Test Migration Locally

```bash
# Reset local database
supabase db reset

# Apply migration
supabase db push

# Verify changes
psql $DATABASE_URL -c "\dt"
psql $DATABASE_URL -c "SELECT * FROM user_preferences;"
```

---

## Migration Types

### Type 1: Schema Change (Table/Column)

```sql
-- Add column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- Create index
CREATE INDEX IF NOT EXISTS idx_profiles_timezone ON profiles(timezone);

-- Add constraint
ALTER TABLE cases 
ADD CONSTRAINT valid_status CHECK (status IN ('new', 'processing', 'done'));
```

### Type 2: Data Migration

```sql
-- Backfill data
UPDATE cases 
SET status = 'new' 
WHERE status IS NULL;

-- Migrate data to new table
INSERT INTO user_preferences (user_id, email_notifications)
SELECT id, true FROM profiles
ON CONFLICT (user_id) DO NOTHING;
```

### Type 3: RLS Policy Change

```sql
-- Drop old policy
DROP POLICY IF EXISTS "old_policy_name" ON cases;

-- Create new policy
CREATE POLICY "cases_user_access"
  ON cases FOR ALL
  USING (user_id = auth.uid());
```

### Type 4: Function/Trigger

```sql
-- Create function
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (...)
  VALUES (...);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS audit_trigger ON cases;
CREATE TRIGGER audit_trigger
  AFTER UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION log_changes();
```

---

## Deployment Process

### Staging Deployment

```bash
# 1. Backup staging (optional but recommended)
supabase db dump --project-ref <staging-ref> -f backup_staging.sql

# 2. Link to staging
supabase link --project-ref <staging-ref>

# 3. Apply migrations
supabase db push

# 4. Verify
# Run smoke tests
# Check application logs
```

### Production Deployment

⚠️ **Requires approval and maintenance window**

```bash
# 1. Verify migrations are applied to staging
supabase migration list

# 2. Backup production
supabase db dump --project-ref <prod-ref> -f backup_prod_$(date +%Y%m%d).sql

# 3. Link to production
supabase link --project-ref <prod-ref>

# 4. Apply migrations during maintenance window
supabase db push

# 5. Verify
# Check /api/health
# Run smoke tests
# Monitor error rates
```

---

## Rollback Procedures

### Scenario 1: Migration Failed During Deploy

```bash
# Migration will automatically rollback on error
# Fix the issue and re-deploy
```

### Scenario 2: Need to Revert Applied Migration

```bash
# 1. Create rollback migration
touch infra/db/migrations/011_rollback_user_preferences.sql

# 2. Write rollback
# Copy the DOWN section from original migration

# 3. Apply rollback
supabase db push
```

### Scenario 3: Data Corruption

```bash
# 1. Stop application
# 2. Restore from backup
pg_restore -d $DATABASE_URL backup_prod_YYYYMMDD.sql

# 3. Re-apply migrations up to the good one
supabase db push
```

---

## Best Practices

### DO

✅ Use `IF EXISTS` / `IF NOT EXISTS` for idempotency
✅ Add comments explaining business logic
✅ Include rollback/down migration
✅ Test on copy of production data when possible
✅ Keep migrations small and focused
✅ Use transactions when possible

### DON'T

❌ Don't modify existing migrations after deployment
❌ Don't delete columns without backing up data
❌ Don't run destructive operations without confirmation
❌ Don't commit migrations without testing
❌ Don't skip migration numbers

---

## Common Issues

### Issue: Migration Conflicts

**Symptoms:** `Migration version mismatch`

**Solution:**
```bash
# List migrations
supabase migration list

# Mark as resolved (if already applied manually)
supabase migration repair 002 --status applied
```

### Issue: RLS Policy Conflicts

**Symptoms:** `Policy already exists`

**Solution:**
```sql
-- Always use IF NOT EXISTS
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ...
```

### Issue: Lock Timeout

**Symptoms:** Migration hangs

**Solution:**
```sql
-- Check locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Kill blocking query
SELECT pg_cancel_backend(pid);
-- or
SELECT pg_terminate_backend(pid);
```

### Issue: Constraint Violation

**Symptoms:** `violates check constraint`

**Solution:**
```sql
-- 1. Fix data first
UPDATE table SET column = 'default' WHERE column IS NULL;

-- 2. Then add constraint
ALTER TABLE table ADD CONSTRAINT ...;
```

---

## Migration Checklist

Before creating:
- [ ] Migration number is next in sequence
- [ ] Purpose is clearly documented
- [ ] Includes rollback/down migration

Before deploying:
- [ ] Tested locally with `supabase db reset`
- [ ] Reviewed by another engineer
- [ ] Staging deployment successful
- [ ] Application smoke tests pass

After deploying:
- [ ] Production deployment successful
- [ ] No new errors in Sentry
- [ ] Application metrics normal
- [ ] Monitoring alerts quiet

---

## Schema Change Checklist

For significant schema changes:

- [ ] Update TypeScript types
- [ ] Update API endpoints
- [ ] Update frontend components
- [ ] Update documentation
- [ ] Notify team of breaking changes
- [ ] Plan data migration if needed

---

## Tools

```bash
# Diff local vs remote
supabase db diff

# Dump schema only
supabase db dump --schema-only

# Dump specific table
pg_dump $DATABASE_URL --table=profiles --data-only

# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Describe table
\d table_name
```

---

## References

- [Supabase Migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Migrations](https://www.postgresql.org/docs/current/sql-altertable.html)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)

---

**Last Updated:** 2024-01
**Owner:** Database Team
