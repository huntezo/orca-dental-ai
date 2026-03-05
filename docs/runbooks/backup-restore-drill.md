# Backup & Restore Drill Runbook

## Overview

This runbook provides step-by-step instructions for performing backup and restore operations, including the quarterly disaster recovery drill.

## Backup Strategy Summary

| Data Type | Frequency | Retention | Method |
|-----------|-----------|-----------|--------|
| Database | Daily (automated) | 7 days | Supabase PITR |
| Database | Weekly (manual) | 30 days | pg_dump |
| Storage | Continuous | 7 days | S3 versioning |
| Storage | Weekly (manual) | 30 days | AWS CLI sync |
| Config | On change | Forever | Git |

## Quarterly DR Drill Schedule

**When:** First Monday of each quarter
**Duration:** 2 hours
**Participants:** DevOps Lead, Database Admin, Engineering Manager

---

## Part 1: Verify Backups (Monthly)

### 1.1 Check Automated Backups

**Supabase Dashboard:**
1. Navigate to Database > Backups
2. Verify daily backups exist
3. Check last backup timestamp (< 24 hours)

**Verify via SQL:**
```sql
-- Check if we can access the database
SELECT version();
SELECT COUNT(*) FROM profiles;
```

### 1.2 Verify Storage Backups

**Check S3 Bucket:**
```bash
# List storage bucket
aws s3 ls s3://<bucket-name>/case-files/ --recursive | head -20

# Check versioning is enabled
aws s3api get-bucket-versioning --bucket <bucket-name>
```

### 1.3 Document Verification

Record in backup log:
```
Date: YYYY-MM-DD
Verified by: [Name]
Database Backup: ✅ Last backup at [timestamp]
Storage Backup: ✅ Versioning enabled
Next Drill: [Date]
```

---

## Part 2: Disaster Recovery Drill (Quarterly)

### Scenario 1: Database Corruption

**Simulated Issue:** Critical table corruption requiring PITR

#### Step 1: Document Current State (5 min)

```sql
-- Record current stats
SELECT 
  'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'cases', COUNT(*) FROM cases
UNION ALL
SELECT 'case_files', COUNT(*) FROM case_files
UNION ALL
SELECT 'ai_results', COUNT(*) FROM ai_results;
```

Save output as `pre-drill-state.txt`

#### Step 2: Note Recovery Point (2 min)

```bash
# Current timestamp
date -u +"%Y-%m-%d %H:%M:%S UTC"
# Record this as our "corruption time"
```

#### Step 3: Perform PITR (15 min)

**Via Supabase Dashboard:**
1. Go to Database > Backups
2. Click "Point in Time Recovery"
3. Select time: 5 minutes before "corruption"
4. Confirm and wait for restoration
5. Note new database connection string

**Update Application:**
```bash
# If connection string changed, update Vercel
vercel env add DATABASE_URL staging
# Redeploy if needed
vercel --target=staging
```

#### Step 4: Verify Restoration (10 min)

```sql
-- Check data is restored
SELECT 
  'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'cases', COUNT(*) FROM cases
UNION ALL
SELECT 'case_files', COUNT(*) FROM case_files;

-- Compare with pre-drill state
```

#### Step 5: Test Application (15 min)

- [ ] Login works
- [ ] Cases are visible
- [ ] File downloads work
- [ ] New case creation works

#### Step 6: Document Results (5 min)

```
Drill Date: YYYY-MM-DD
Scenario: Database Corruption (PITR)
Recovery Time: XX minutes
Data Loss: None (PITR to 5 min before)
Issues Found: [Any issues]
Improvements Needed: [Action items]
```

---

### Scenario 2: Complete Database Loss

**Simulated Issue:** Database completely deleted, restore from dump

#### Step 1: Create Fresh Database (10 min)

**Via Supabase Dashboard:**
1. Create new project or new database
2. Note connection string
3. Apply migrations:

```bash
# Run all migrations
supabase db push --project-ref=<new-ref>
```

#### Step 2: Restore from Latest Backup (15 min)

```bash
# Download latest backup
pg_restore \
  --host=<new-host> \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --no-owner \
  --no-privileges \
  backup/orca_backup_YYYYMMDD.sql
```

#### Step 3: Apply Recent Migrations (5 min)

```bash
# Apply any migrations since backup
supabase db push --project-ref=<new-ref>
```

#### Step 4: Update Application (5 min)

```bash
# Update DATABASE_URL in Vercel
vercel env add DATABASE_URL staging

# Redeploy
vercel --target=staging
```

#### Step 5: Verify (10 min)

- [ ] Application connects to new database
- [ ] All data present
- [ ] RLS policies working
- [ ] Edge functions accessible

---

### Scenario 3: Storage Recovery

**Simulated Issue:** Accidental deletion of storage files

#### Step 1: Identify Missing Files (5 min)

```sql
-- Find files that should exist
SELECT id, file_path, file_name 
FROM case_files 
WHERE created_at > NOW() - INTERVAL '7 days';
```

#### Step 2: Restore from S3 Versioning (15 min)

```bash
# List deleted object versions
aws s3api list-object-versions \
  --bucket <bucket> \
  --prefix case-files/ \
  --query 'DeleteMarkers[?IsLatest==`true`][]'

# Restore specific version
aws s3api get-object \
  --bucket <bucket> \
  --key case-files/user/file.jpg \
  --version-id <version-id> \
  restored-file.jpg

# Or restore all recent deletions (use with caution)
# Script to restore latest version for all delete markers
```

#### Step 3: Verify Files (5 min)

- [ ] Files accessible via application
- [ ] Signed URLs work
- [ ] File integrity verified (check file sizes)

---

## Part 3: Backup Procedures

### Manual Database Backup

```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/database"
mkdir -p $BACKUP_DIR

# Full backup
pg_dump $DATABASE_URL \
  --format=custom \
  --file=$BACKUP_DIR/orca_full_$DATE.dump

# Schema only
pg_dump $DATABASE_URL \
  --schema-only \
  --file=$BACKUP_DIR/orca_schema_$DATE.sql

# Data only (excluding large tables if needed)
pg_dump $DATABASE_URL \
  --data-only \
  --exclude-table=audit_logs \
  --exclude-table=access_logs \
  --file=$BACKUP_DIR/orca_data_$DATE.sql

echo "Backup completed: $DATE"
```

### Manual Storage Backup

```bash
#!/bin/bash
# backup-storage.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="backups/storage/$DATE"
mkdir -p $BACKUP_DIR

# Sync all files
aws s3 sync \
  s3://<bucket>/case-files \
  $BACKUP_DIR/case-files \
  --storage-class STANDARD_IA

# Create manifest
find $BACKUP_DIR -type f > $BACKUP_DIR/manifest.txt

echo "Storage backup completed: $DATE"
```

### Automated Backup Verification

```bash
#!/bin/bash
# verify-backup.sh

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1;" || exit 1

# Check storage bucket
aws s3 ls s3://<bucket>/case-files/ || exit 1

# Check backup exists (< 25 hours old)
find backups/database -name "*.dump" -mtime -1 | grep . || exit 1

echo "All backups verified"
```

---

## Recovery Time Objectives (RTO)

| Scenario | Target RTO | Actual (Last Drill) |
|----------|-----------|-------------------|
| Database PITR | 30 minutes | XX minutes |
| Database Restore | 1 hour | XX minutes |
| Storage Restore | 30 minutes | XX minutes |
| Complete Site | 4 hours | XX minutes |

## Checklist Template

Pre-Drill:
- [ ] Schedule drill with team
- [ ] Notify stakeholders (low-impact window)
- [ ] Prepare test scenarios
- [ ] Verify backup access

During Drill:
- [ ] Document start time
- [ ] Follow runbook steps
- [ ] Record any issues
- [ ] Time each step

Post-Drill:
- [ ] Document end time
- [ ] Calculate RTO
- [ ] Identify improvements
- [ ] Update runbooks
- [ ] Schedule follow-up

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| DevOps Lead | [Name] | [Phone] | [Email] |
| Database Admin | [Name] | [Phone] | [Email] |
| Engineering Manager | [Name] | [Phone] | [Email] |
| Supabase Support | - | - | support@supabase.io |

## References

- [Supabase Backups](https://supabase.com/docs/guides/platform/backups)
- [AWS S3 Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)
- [PostgreSQL Backup](https://www.postgresql.org/docs/current/backup.html)

---

**Last Drill:** YYYY-MM-DD
**Next Drill:** YYYY-MM-DD
**Owner:** DevOps Team
