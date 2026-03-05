-- Migration 006: AI Jobs Queue System
-- Creates job queue table for async AI processing

-- Create ai_jobs table
CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',  -- queued, processing, done, failed, cancelled
  model TEXT NOT NULL DEFAULT 'orca-ceph-v1',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  priority INTEGER NOT NULL DEFAULT 0,  -- Higher number = higher priority
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  result_id UUID REFERENCES ai_results(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS ai_jobs_status_idx ON ai_jobs(status);
CREATE INDEX IF NOT EXISTS ai_jobs_user_created_idx ON ai_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_jobs_case_idx ON ai_jobs(case_id);
CREATE INDEX IF NOT EXISTS ai_jobs_status_created_idx ON ai_jobs(status, created_at) 
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS ai_jobs_processing_idx ON ai_jobs(status, started_at) 
  WHERE status = 'processing';

-- Enable RLS
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own jobs
CREATE POLICY "ai_jobs_select_own" ON ai_jobs
  FOR SELECT USING (user_id = auth.uid());

-- Users can only insert their own jobs
CREATE POLICY "ai_jobs_insert_own" ON ai_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only update their own jobs (for cancellation)
CREATE POLICY "ai_jobs_update_own" ON ai_jobs
  FOR UPDATE USING (user_id = auth.uid());

-- Users cannot delete jobs (soft delete via status only)
CREATE POLICY "ai_jobs_no_delete" ON ai_jobs
  FOR DELETE USING (false);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_jobs_updated_at_trigger
  BEFORE UPDATE ON ai_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_jobs_updated_at();

-- Function to claim next job (used by worker with service role)
CREATE OR REPLACE FUNCTION claim_next_ai_job(worker_id TEXT)
RETURNS TABLE (
  job_id UUID,
  job_user_id UUID,
  job_case_id UUID,
  job_model TEXT,
  job_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH next_job AS (
    SELECT ai_jobs.id
    FROM ai_jobs
    WHERE ai_jobs.status = 'queued'
    ORDER BY ai_jobs.priority DESC, ai_jobs.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE ai_jobs
  SET 
    status = 'processing',
    started_at = NOW(),
    attempts = attempts + 1,
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{worker_id}',
      to_jsonb(worker_id)
    )
  FROM next_job
  WHERE ai_jobs.id = next_job.id
  RETURNING ai_jobs.id, ai_jobs.user_id, ai_jobs.case_id, ai_jobs.model, ai_jobs.attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get job statistics (for admin/monitoring)
CREATE OR REPLACE FUNCTION get_ai_job_stats(user_uuid UUID DEFAULT NULL)
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  oldest_job TIMESTAMPTZ,
  newest_job TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai_jobs.status,
    COUNT(*)::BIGINT,
    MIN(ai_jobs.created_at) as oldest_job,
    MAX(ai_jobs.created_at) as newest_job
  FROM ai_jobs
  WHERE (user_uuid IS NULL OR ai_jobs.user_id = user_uuid)
  GROUP BY ai_jobs.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE ai_jobs IS 'Job queue for async AI analysis processing';
COMMENT ON COLUMN ai_jobs.status IS 'Current job status: queued, processing, done, failed, cancelled';
COMMENT ON COLUMN ai_jobs.attempts IS 'Number of processing attempts made';
COMMENT ON COLUMN ai_jobs.metadata IS 'Additional job metadata including worker_id';
