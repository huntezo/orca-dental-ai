# Changelog

All notable changes to Orca Dental AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-beta.1] - 2024-01

### Sprint 9: Private Beta Readiness

#### Added
- **Environment Strategy**: Three-tier environment setup (dev, staging, production)
- **Private Beta Allowlist**: Email-based registration control for beta period
  - `beta_allowlist` table with RLS policies
  - `/beta-check` Edge Function for secure validation
  - Admin UI for managing allowlist at `/admin/beta`
- **Feature Flags**: Runtime feature toggles (`NEXT_PUBLIC_BETA_MODE`, `NEXT_PUBLIC_ENABLE_ADMIN`)
- **Environment Guard**: Runtime validation to prevent misconfigurations
- **Health Endpoint**: `/api/health` for system status monitoring
- **Metrics Endpoint**: `/api/metrics` for admin dashboard analytics
- **Runbooks**: Operational documentation
  - Incident response procedures
  - Backup and restore drill
  - Edge function deployment guide
  - Database migration guide
  - Beta onboarding process
- **CI/CD**: Staging branch workflow for beta deployments

#### Changed
- Expanded `.env.example` with comprehensive configuration options
- Updated Sentry configuration with release tracking

### Sprint 8: Medical Compliance & Security Hardening

#### Added
- **Data Minimization**: `patient_code` validation to prevent PII storage
- **Access Logs**: HIPAA-compliant logging for file downloads (2-year retention)
- **Account Lockout**: 5 failed login attempts trigger 30-minute lockout
- **Rate Limiting**: IP-based and user-based rate limiting
- **CSRF Protection**: Double-submit cookie pattern implementation
- **Storage Hardening**: 10-minute signed URL expiry (down from 1 hour)
- **Encryption Documentation**: Field-level encryption utilities
- **Backup & Recovery**: Documented procedures with RTO targets
- **Security Checklist**: Comprehensive security documentation

#### Security
- Added `login_attempts` table for brute force protection
- Added `account_lockouts` table for automatic lockout tracking
- Added `access_logs` table for audit trail
- Added `encryption_metadata` table for encryption tracking
- Implemented CORS hardening in Next.js config
- Added security headers (CSP, HSTS, X-Frame-Options, etc.)

### Sprint 7: Enterprise Management & Observability

#### Added
- **Super Admin Role**: Role-based access control with `admin` and `user` roles
- **Admin Dashboard**: `/admin` with overview, users, jobs, and analytics
- **Materialized Views**: Analytics views for performance
  - `mv_analyses_per_user_month`
  - `mv_storage_usage_per_user`
  - `mv_daily_analytics`
- **Audit Logging**: `audit_logs` table tracking all important actions
  - Auto-triggers for case creation, file upload, analysis start
  - Admin query interface
- **System Health**: `/api/health` endpoint with database, storage, auth checks
- **Sentry Integration**: Error tracking and performance monitoring

#### Added Admin Features
- User management with suspend functionality
- Job monitoring dashboard (queued, processing, failed)
- Analytics dashboard with growth charts
- Audit log viewer

### Sprint 6: Worker Architecture

#### Added
- **AI Jobs Queue**: `ai_jobs` table with state machine (queued → processing → done/failed)
- **Worker Process**: Node.js TypeScript worker for AI processing
  - Polls database every 5 seconds
  - Atomic job claiming with `claim_next_ai_job()`
  - Docker support for deployment
- **Retry Logic**: Configurable max attempts with exponential backoff
- **Job Status API**: Real-time job status polling for frontend

#### Changed
- Migrated from synchronous Edge Function to async worker queue
- Analysis requests now return job ID for polling

### Sprint 5: Edge Functions & Security

#### Added
- **Edge Functions**: Supabase Edge Functions for serverless operations
  - `process-analysis`: Queue AI analysis jobs
- **Rate Limiting**: 5 analyses per hour per user
- **Security Headers**: CSP, HSTS, X-Frame-Options
- **CI/CD Pipeline**: GitHub Actions for automated testing and deployment

### Sprint 4: PDF Reports

#### Added
- **PDF Generation**: Bilingual PDF reports using pdf-lib
- **Report Storage**: Automatic upload to Supabase Storage
- **Signed URLs**: Secure 1-hour download links (later reduced to 10 minutes)
- **Report History**: Track all generated reports in `case_files` table

### Sprint 3: Mock AI & Results

#### Added
- **AI Results**: `ai_results` table for storing analysis results
- **Mock Analysis**: Simulated AI processing with configurable delay
- **Results Page**: Display analysis results with measurements
- **Polling**: Real-time status updates during processing

### Sprint 2: Cases & File Upload

#### Added
- **Case Management**: Create and manage patient cases
- **File Upload**: Drag-and-drop file upload to Supabase Storage
- **Case Files**: `case_files` table linking files to cases
- **Dashboard**: User dashboard with case listing

### Sprint 1: Foundation

#### Added
- **Project Setup**: Next.js 15 with TypeScript, Tailwind CSS
- **Internationalization**: English/Arabic with RTL support
- **Authentication**: Supabase Auth with email/password
- **Database Schema**: Initial tables (profiles, cases)
- **Marketing Site**: Landing page, about, services, contact, blog
- **Database Migrations**: Structured migration system

---

## Release Notes

### Beta (Current)
**Version**: 1.0.0-beta.1
**Status**: Private beta with 10-30 doctors
**Environment**: Staging
**Features**:
- Full AI analysis workflow
- PDF report generation
- Admin dashboard
- Beta allowlist
- Comprehensive security

### Production (Planned)
**Target**: Q2 2024
**Requirements**:
- 30+ successful beta analyses
- Zero critical bugs for 2 weeks
- Security audit passed
- Performance benchmarks met

---

## Migration Notes

### Database Migrations
Run migrations in order:
```bash
supabase db push
```

### Environment Variables
See `.env.example` for required variables per environment.

### Breaking Changes
None in beta release.

---

**Maintained by**: Orca Dental AI Team
**Last Updated**: 2024-01
