-- Migration 005: Edge AI Rate Limiting Indexes
-- Adds indexes for efficient rate limiting checks in Edge Function

-- Index for rate limiting: count analyses per user in time window
CREATE INDEX IF NOT EXISTS ai_results_user_started_idx 
ON ai_results(user_id, started_at DESC);

-- Index for quickly fetching latest result for a case (used in polling)
CREATE INDEX IF NOT EXISTS ai_results_case_created_idx 
ON ai_results(case_id, created_at DESC);

-- Index for case files by type (for reports filtering)
CREATE INDEX IF NOT EXISTS case_files_case_type_idx 
ON case_files(case_id, file_type);

-- Add comment explaining rate limiting logic
COMMENT ON INDEX ai_results_user_started_idx IS 
'Supports rate limiting query: count analyses per user in last hour';
