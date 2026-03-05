-- Migration 012: AI Queue System and Multi-Provider Architecture
-- Production-grade job queue with provider fallback support

-- ============================================
-- PART 1: AI PROVIDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ai_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('external', 'local')),
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one primary provider
CREATE UNIQUE INDEX IF NOT EXISTS ai_providers_single_primary_idx 
  ON ai_providers(is_primary) 
  WHERE is_primary = TRUE;

-- Indexes for providers
CREATE INDEX IF NOT EXISTS ai_providers_active_idx ON ai_providers(is_active);
CREATE INDEX IF NOT EXISTS ai_providers_type_idx ON ai_providers(type);

-- Enable RLS
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;

-- Only admins can manage providers
CREATE POLICY "ai_providers_admin_all" ON ai_providers
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ai_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_providers_updated_at_trigger
  BEFORE UPDATE ON ai_providers
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_providers_updated_at();

-- ============================================
-- PART 2: ANALYSIS JOBS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES ai_providers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed', 'timeout')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  model_version TEXT,
  result_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for analysis_jobs
CREATE INDEX IF NOT EXISTS analysis_jobs_status_idx ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS analysis_jobs_case_id_idx ON analysis_jobs(case_id);
CREATE INDEX IF NOT EXISTS analysis_jobs_created_at_idx ON analysis_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS analysis_jobs_user_id_idx ON analysis_jobs(user_id);
CREATE INDEX IF NOT EXISTS analysis_jobs_status_created_idx ON analysis_jobs(status, created_at) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS analysis_jobs_processing_idx ON analysis_jobs(status, started_at) 
  WHERE status = 'processing';

-- Enable RLS
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Users can read their own jobs
CREATE POLICY "analysis_jobs_user_select" ON analysis_jobs
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own jobs
CREATE POLICY "analysis_jobs_user_insert" ON analysis_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users cannot update/delete jobs directly (worker handles this)
CREATE POLICY "analysis_jobs_user_no_update" ON analysis_jobs
  FOR UPDATE USING (false);

-- Admins can read all jobs
CREATE POLICY "analysis_jobs_admin_select" ON analysis_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_analysis_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analysis_jobs_updated_at_trigger
  BEFORE UPDATE ON analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_analysis_jobs_updated_at();

-- ============================================
-- PART 3: JOB PROCESSING FUNCTIONS
-- ============================================

-- Function to claim next pending job (used by worker with service role)
CREATE OR REPLACE FUNCTION claim_next_analysis_job(p_worker_id TEXT DEFAULT 'worker-1')
RETURNS TABLE (
  job_id UUID,
  job_case_id UUID,
  job_user_id UUID,
  job_attempts INTEGER,
  job_max_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH next_job AS (
    SELECT analysis_jobs.id
    FROM analysis_jobs
    WHERE analysis_jobs.status = 'pending'
    ORDER BY analysis_jobs.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE analysis_jobs
  SET 
    status = 'processing',
    started_at = NOW(),
    attempts = attempts + 1
  FROM next_job
  WHERE analysis_jobs.id = next_job.id
  RETURNING 
    analysis_jobs.id, 
    analysis_jobs.case_id, 
    analysis_jobs.user_id, 
    analysis_jobs.attempts,
    analysis_jobs.max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a job successfully
CREATE OR REPLACE FUNCTION complete_analysis_job(
  p_job_id UUID,
  p_provider_id UUID,
  p_duration_ms INTEGER,
  p_model_version TEXT,
  p_result_json JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE analysis_jobs
  SET 
    status = 'done',
    finished_at = NOW(),
    duration_ms = p_duration_ms,
    provider_id = p_provider_id,
    model_version = p_model_version,
    result_json = p_result_json
  WHERE id = p_job_id;
  
  -- Track telemetry
  PERFORM track_event(
    (SELECT user_id FROM analysis_jobs WHERE id = p_job_id),
    'analysis_done',
    p_job_id,
    jsonb_build_object(
      'provider_id', p_provider_id,
      'duration_ms', p_duration_ms,
      'model_version', p_model_version
    )
  );
  
  -- Create notification for user
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    (SELECT user_id FROM analysis_jobs WHERE id = p_job_id),
    'analysis_complete',
    'Analysis Complete',
    'Your case analysis has been completed successfully',
    jsonb_build_object('case_id', (SELECT case_id FROM analysis_jobs WHERE id = p_job_id))
  );
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fail a job
CREATE OR REPLACE FUNCTION fail_analysis_job(
  p_job_id UUID,
  p_error_code TEXT,
  p_error_message TEXT,
  p_fallback_used BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE analysis_jobs
  SET 
    status = 'failed',
    finished_at = NOW(),
    error_code = p_error_code,
    error_message = p_error_message,
    fallback_used = p_fallback_used
  WHERE id = p_job_id;
  
  -- Track telemetry
  PERFORM track_event(
    (SELECT user_id FROM analysis_jobs WHERE id = p_job_id),
    'analysis_failed',
    p_job_id,
    jsonb_build_object(
      'error_code', p_error_code,
      'fallback_used', p_fallback_used
    )
  );
  
  -- Create notification for user
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    (SELECT user_id FROM analysis_jobs WHERE id = p_job_id),
    'analysis_failed',
    'Analysis Failed',
    'Your case analysis could not be completed. Please try again.',
    jsonb_build_object(
      'case_id', (SELECT case_id FROM analysis_jobs WHERE id = p_job_id),
      'error', p_error_message
    )
  );
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retry a job (set back to pending)
CREATE OR REPLACE FUNCTION retry_analysis_job(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_attempts INTEGER;
  v_max_attempts INTEGER;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
  FROM analysis_jobs WHERE id = p_job_id;
  
  IF v_attempts >= v_max_attempts THEN
    RETURN FALSE;
  END IF;
  
  UPDATE analysis_jobs
  SET 
    status = 'pending',
    started_at = NULL,
    error_code = NULL,
    error_message = NULL
  WHERE id = p_job_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark timed out jobs
CREATE OR REPLACE FUNCTION timeout_stuck_jobs(p_timeout_minutes INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE analysis_jobs
  SET 
    status = 'timeout',
    finished_at = NOW(),
    error_code = 'TIMEOUT',
    error_message = 'Job exceeded ' || p_timeout_minutes || ' minutes processing time'
  WHERE status = 'processing'
    AND started_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Track telemetry for timed out jobs
  PERFORM track_event(
    user_id,
    'analysis_failed',
    id,
    jsonb_build_object('error_code', 'TIMEOUT')
  )
  FROM analysis_jobs
  WHERE status = 'timeout'
    AND updated_at > NOW() - INTERVAL '1 minute';
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get primary provider
CREATE OR REPLACE FUNCTION get_primary_provider()
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  provider_type TEXT,
  provider_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai_providers.id,
    ai_providers.name,
    ai_providers.type,
    ai_providers.config
  FROM ai_providers
  WHERE ai_providers.is_primary = TRUE AND ai_providers.is_active = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get fallback provider
CREATE OR REPLACE FUNCTION get_fallback_provider()
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  provider_type TEXT,
  provider_config JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai_providers.id,
    ai_providers.name,
    ai_providers.type,
    ai_providers.config
  FROM ai_providers
  WHERE ai_providers.is_primary = FALSE 
    AND ai_providers.is_active = TRUE
  ORDER BY ai_providers.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 4: ANALYTICS FUNCTIONS
-- ============================================

-- Function to get provider statistics
CREATE OR REPLACE FUNCTION get_provider_stats(p_provider_id UUID DEFAULT NULL)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  total_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT,
  avg_duration_ms NUMERIC,
  failure_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id,
    ap.name,
    COUNT(aj.id)::BIGINT AS total_jobs,
    COUNT(*) FILTER (WHERE aj.status = 'done')::BIGINT AS completed_jobs,
    COUNT(*) FILTER (WHERE aj.status = 'failed')::BIGINT AS failed_jobs,
    COALESCE(AVG(aj.duration_ms) FILTER (WHERE aj.status = 'done'), 0)::NUMERIC AS avg_duration_ms,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        (COUNT(*) FILTER (WHERE aj.status = 'failed')::NUMERIC / COUNT(*)::NUMERIC * 100)
      ELSE 0 
    END AS failure_rate
  FROM ai_providers ap
  LEFT JOIN analysis_jobs aj ON aj.provider_id = ap.id
  WHERE (p_provider_id IS NULL OR ap.id = p_provider_id)
  GROUP BY ap.id, ap.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent job stats for a provider
CREATE OR REPLACE FUNCTION get_provider_recent_stats(p_provider_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  avg_duration_ms NUMERIC,
  failure_rate NUMERIC,
  total_jobs BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(AVG(aj.duration_ms) FILTER (WHERE aj.status = 'done'), 0)::NUMERIC AS avg_duration_ms,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        (COUNT(*) FILTER (WHERE aj.status IN ('failed', 'timeout'))::NUMERIC / COUNT(*)::NUMERIC * 100)
      ELSE 0 
    END AS failure_rate,
    COUNT(*)::BIGINT AS total_jobs
  FROM analysis_jobs aj
  WHERE aj.provider_id = p_provider_id
  ORDER BY aj.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track fallback usage
CREATE OR REPLACE FUNCTION track_fallback_usage(
  p_job_id UUID,
  p_primary_provider_id UUID,
  p_fallback_provider_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Update job to mark fallback used
  UPDATE analysis_jobs
  SET fallback_used = TRUE
  WHERE id = p_job_id;
  
  -- Track telemetry
  PERFORM track_event(
    (SELECT user_id FROM analysis_jobs WHERE id = p_job_id),
    'analysis_fallback_used',
    p_job_id,
    jsonb_build_object(
      'primary_provider_id', p_primary_provider_id,
      'fallback_provider_id', p_fallback_provider_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 5: SEED DATA
-- ============================================

-- Insert default local provider (will be configured by admin)
INSERT INTO ai_providers (name, type, is_primary, is_active, config)
VALUES (
  'Local Model Server',
  'local',
  TRUE,
  TRUE,
  jsonb_build_object(
    'endpoint', 'http://local-model:8000',
    'timeout_ms', 300000,
    'version', 'v1.0'
  )
)
ON CONFLICT DO NOTHING;

-- ============================================
-- PART 6: COMMENTS
-- ============================================

COMMENT ON TABLE ai_providers IS 'AI model providers - external APIs or local servers';
COMMENT ON TABLE analysis_jobs IS 'Production-grade job queue for AI analysis with retry and fallback';
COMMENT ON FUNCTION claim_next_analysis_job IS 'Claims next pending job for worker processing';
COMMENT ON FUNCTION complete_analysis_job IS 'Marks job as successfully completed';
COMMENT ON FUNCTION fail_analysis_job IS 'Marks job as failed with error details';
COMMENT ON FUNCTION timeout_stuck_jobs IS 'Marks jobs as timeout if processing too long';
