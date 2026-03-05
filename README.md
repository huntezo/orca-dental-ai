# Orca Dental AI

AI-powered orthodontic imaging and diagnostic platform

## Features

- **AI Analysis**: Cephalometric analysis with AI-powered measurements
- **Bilingual Support**: English and Arabic (EN/AR) with RTL support
- **Secure Storage**: Private file storage with RLS protection
- **PDF Reports**: Generate and download professional diagnostic reports
- **Edge Functions**: Serverless AI processing with rate limiting

## Tech Stack

- **Frontend**: Next.js 15 App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **Monitoring**: Sentry error tracking
- **Deployment**: Vercel (frontend), Supabase (backend)

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase CLI (for local development)

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd orca-dental-ai/apps/web
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn (optional)
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Vercel Deployment

1. **Import Project**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository

2. **Configure Build Settings**:
   - Framework Preset: Next.js
   - Root Directory: `apps/web`
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Environment Variables**:
   Add these environment variables in Vercel dashboard:

   | Variable | Description | Required |
   |----------|-------------|----------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Yes |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |
   | `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking | No |

4. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy automatically

### Supabase Edge Functions Deployment

1. **Install Supabase CLI**:
```bash
npm install -g supabase
```

2. **Login and Link**:
```bash
supabase login
supabase link --project-ref <your-project-ref>
```

3. **Deploy the Edge Function**:
```bash
supabase functions deploy process-analysis
```

4. **Set Environment Variables** (if needed):
```bash
supabase secrets set SUPABASE_URL=<your-supabase-url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Database Migrations

Apply migrations to your Supabase project:

```bash
# Using Supabase CLI
supabase db push

# Or apply manually via SQL Editor in Supabase Dashboard
# Copy contents from infra/db/migrations/*.sql
```

### CI/CD with GitHub Actions

The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that:
- Runs on push to `main` and `develop` branches
- Runs on pull requests
- Validates route folder names
- Builds the application
- Runs ESLint

**Required GitHub Secrets**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SENTRY_DSN` (optional)

Add these in: Settings > Secrets and variables > Actions

## Architecture

### Directory Structure

```
apps/web/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── [locale]/     # i18n routes (EN/AR)
│   │   │   ├── app/      # Dashboard routes
│   │   │   ├── auth/     # Authentication pages
│   │   │   └── ...       # Marketing pages
│   ├── components/       # React components
│   ├── lib/             # Utilities and data layer
│   │   ├── db/          # Database functions
│   │   ├── services/    # Business logic (PDF, etc.)
│   │   └── supabase/    # Supabase clients
│   └── messages/        # i18n translations
├── supabase/
│   └── functions/       # Edge Functions
│       └── process-analysis/
├── infra/
│   └── db/migrations/   # SQL migrations
└── ...
```

### Security

- **RLS**: Row Level Security on all tables
- **Storage**: Private buckets with signed URLs
- **CSP**: Content Security Policy headers
- **Rate Limiting**: 5 analyses per hour per user
- **Sentry**: Error tracking and monitoring

## How to Test

### 1. Register and Login
- Create a new account at `/auth/register`
- Login at `/auth/login`

### 2. Create a Case
- Go to Dashboard
- Click "New Case"
- Enter patient code and optional notes

### 3. Upload Files
- Open the case detail page
- Click "Upload Files"
- Select JPG, PNG, PDF, or DICOM files (max 25MB)

### 4. Start Analysis
- Click "Start Analysis" button
- System will process via Edge Function (8-15 seconds)
- View status updates in real-time

### 5. View Results
- Navigate to Results page when analysis is done
- View measurements, findings, and recommendations
- Generate PDF report

### 6. Rate Limiting Test
- Try starting more than 5 analyses in one hour
- Should receive "Rate limit exceeded" error

### 7. Error Handling
- Test failure scenario by retrying if analysis fails
- Verify error boundary shows friendly error UI

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public API key |

### Optional

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking |
| `SENTRY_DSN` | Server-side Sentry DSN |

## Edge Function Rate Limiting

The `process-analysis` Edge Function implements rate limiting:
- **Limit**: 5 analyses per hour per user
- **Window**: Rolling 1-hour window
- **Response**: HTTP 429 when exceeded

Database index for efficient rate limiting:
```sql
CREATE INDEX ai_results_user_started_idx ON ai_results(user_id, started_at DESC);
```

## PDF Generation Notes

### Arabic Text Shaping
The PDF generator uses `pdf-lib` which does not support complex Arabic text shaping (ligatures, contextual forms). Arabic text is rendered as isolated characters but remains readable. For production-grade Arabic PDFs, consider:
- Server-side rendering with Puppeteer
- Using a library with full Arabic support

### Performance
PDF generation is dynamically imported to reduce initial bundle size:
```typescript
const { generateAIReportPDF } = await import("@/lib/services/pdfGenerator");
```

## License

[Your License Here]

## Support

For support, email support@orcadental.ai or create an issue in the repository.
