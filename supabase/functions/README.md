# Supabase Edge Functions

This directory contains Supabase Edge Functions for Orca Dental AI.

## Available Functions

### `process-analysis`
Processes AI dental analysis requests with rate limiting and mock result generation.

**Features:**
- Authentication required (Bearer token)
- Rate limiting: 5 analyses per hour per user
- Async processing with 8-15 second delay
- Generates realistic cephalometric analysis results
- Stores results in `ai_results` table

## Deployment

### Prerequisites

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link to your project:
```bash
supabase link --project-ref <your-project-ref>
```

### Deploy Functions

Deploy all functions:
```bash
supabase functions deploy
```

Deploy specific function:
```bash
supabase functions deploy process-analysis
```

### Environment Variables

Set required environment variables:

```bash
supabase secrets set SUPABASE_URL=<your-supabase-url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Or use `.env` file in the project root and deploy with:
```bash
supabase secrets set --env-file ./supabase/.env
```

### Local Development

Run functions locally:
```bash
supabase functions serve
```

Test with curl:
```bash
curl -X POST http://localhost:54321/functions/v1/process-analysis \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"caseId": "<case_uuid>"}'
```

## Usage from Frontend

```typescript
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-analysis`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ caseId: 'your-case-id' }),
  }
);

const result = await response.json();
```

## Rate Limiting

The `process-analysis` function limits users to 5 analyses per hour.
The rate limit is enforced using the `ai_results.started_at` timestamp.

Database index for efficient rate limiting:
```sql
CREATE INDEX ai_results_user_started_idx ON ai_results(user_id, started_at DESC);
```

## Error Handling

The function returns appropriate HTTP status codes:
- `202 Accepted` - Analysis started successfully
- `400 Bad Request` - Invalid request body
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Access denied (case belongs to another user)
- `404 Not Found` - Case not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
