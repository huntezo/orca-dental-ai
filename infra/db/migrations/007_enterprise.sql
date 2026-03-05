-- Migration 007: Enterprise Management & Observability
-- Adds admin roles, audit logging, and analytics

-- ============================================
-- PART A: SUPER ADMIN ROLE
-- ============================================

-- Add role column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' 
CHECK (role IN ('user', 'admin'));

-- Add index for role queries
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- Update RLS policies to allow admin access
-- Admin can view all profiles
CREATE POLICY "profiles_admin_select_all" ON profiles
  FOR SELECT 
  USING (
    role = 'admin' OR 
    id = auth.uid()
  );

-- Admin can update any profile (for suspension)
CREATE POLICY "profiles_admin_update_all" ON profiles
  FOR UPDATE 
  USING (role = 'admin')
  WITH CHECK (role = 'admin');

-- ============================================
-- PART B: USAGE ANALYTICS (Materialized Views)
-- ============================================

-- Materialized view: Analyses per user per month
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_analyses_per_user_month AS
SELECT 
  user_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS total_analyses,
  COUNT(*) FILTER (WHERE status = 'done') AS completed_analyses,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_analyses,
  AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) FILTER (WHERE status = 'done') AS avg_processing_seconds
FROM ai_results
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS mv_analyses_user_month_idx 
ON mv_analyses_per_user_month(user_id, month);

-- Materialized view: Storage usage per user
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_storage_usage_per_user AS
SELECT 
  user_id,
  COUNT(*) AS total_files,
  COALESCE(SUM(size_bytes), 0) AS total_bytes,
  COUNT(*) FILTER (WHERE file_type = 'report') AS report_count,
  COUNT(*) FILTER (WHERE file_type != 'report') AS case_file_count
FROM case_files
GROUP BY user_id;

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS mv_storage_user_idx 
ON mv_storage_usage_per_user(user_id);

-- Materialized view: Daily analytics summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) AS date,
  COUNT(DISTINCT user_id) AS active_users,
  COUNT(*) FILTER (FROM cases) AS new_cases,
  COUNT(*) FILTER (FROM ai_results) AS new_analyses,
  COUNT(*) FILTER (FROM ai_results WHERE status = 'done') AS completed_analyses,
  COUNT(*) FILTER (FROM ai_results WHERE status = 'failed') AS failed_analyses
FROM (
  SELECT user_id, created_at FROM cases
  UNION ALL
  SELECT user_id, created_at FROM ai_results
) combined
GROUP BY DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_analytics_date_idx 
ON mv_daily_analytics(date);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_analyses_per_user_month;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_storage_usage_per_user;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_analytics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART C: AUDIT LOG
-- ============================================

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_action_idx ON audit_logs(entity, action);

-- Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "audit_logs_admin_select" ON audit_logs
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can insert audit logs
CREATE POLICY "audit_logs_service_insert" ON audit_logs
  FOR INSERT 
  WITH CHECK (true);

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_entity TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata)
  VALUES (p_user_id, p_action, p_entity, p_entity_id, p_metadata)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART D: SYSTEM STATS FUNCTIONS
-- ============================================

-- Function to get admin dashboard stats
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE (
  total_users BIGINT,
  active_subscriptions BIGINT,
  total_analyses BIGINT,
  failed_analyses BIGINT,
  total_cases BIGINT,
  total_storage_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles) AS total_users,
    (SELECT COUNT(*) FROM profiles WHERE subscription_status = 'active') AS active_subscriptions,
    (SELECT COUNT(*) FROM ai_results) AS total_analyses,
    (SELECT COUNT(*) FROM ai_results WHERE status = 'failed') AS failed_analyses,
    (SELECT COUNT(*) FROM cases) AS total_cases,
    (SELECT COALESCE(SUM(total_bytes), 0) FROM mv_storage_usage_per_user) AS total_storage_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent failed jobs
CREATE OR REPLACE FUNCTION get_recent_failed_jobs(limit_count INT DEFAULT 50)
RETURNS TABLE (
  job_id UUID,
  user_id UUID,
  case_id UUID,
  error_message TEXT,
  attempts INTEGER,
  created_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ai_jobs.id,
    ai_jobs.user_id,
    ai_jobs.case_id,
    ai_jobs.error_message,
    ai_jobs.attempts,
    ai_jobs.created_at,
    ai_jobs.finished_at
  FROM ai_jobs
  WHERE ai_jobs.status = 'failed'
  ORDER BY ai_jobs.finished_at DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to suspend a user (admin only)
CREATE OR REPLACE FUNCTION suspend_user(target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  -- Check if caller is admin
  SELECT role INTO v_admin_role FROM profiles WHERE id = auth.uid();
  
  IF v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can suspend users';
  END IF;
  
  -- Update user subscription status
  UPDATE profiles 
  SET subscription_status = 'suspended',
      updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Create audit log
  PERFORM create_audit_log(
    auth.uid(),
    'suspend_user',
    'profile',
    target_user_id,
    jsonb_build_object('admin_id', auth.uid())
  );
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART E: TRIGGER FUNCTIONS FOR AUDIT LOGGING
-- ============================================

-- Trigger function to log case creation
CREATE OR REPLACE FUNCTION log_case_creation()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_audit_log(
    NEW.user_id,
    'create_case',
    'case',
    NEW.id,
    jsonb_build_object('patient_code', NEW.patient_code)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for case creation
DROP TRIGGER IF EXISTS case_creation_audit ON cases;
CREATE TRIGGER case_creation_audit
  AFTER INSERT ON cases
  FOR EACH ROW
  EXECUTE FUNCTION log_case_creation();

-- Trigger function to log file upload
CREATE OR REPLACE FUNCTION log_file_upload()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_audit_log(
    NEW.user_id,
    'upload_file',
    'case_file',
    NEW.id,
    jsonb_build_object(
      'case_id', NEW.case_id,
      'file_name', NEW.file_name,
      'file_type', NEW.file_type,
      'size_bytes', NEW.size_bytes
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for file upload
DROP TRIGGER IF EXISTS file_upload_audit ON case_files;
CREATE TRIGGER file_upload_audit
  AFTER INSERT ON case_files
  FOR EACH ROW
  EXECUTE FUNCTION log_file_upload();

-- Trigger function to log analysis start
CREATE OR REPLACE FUNCTION log_analysis_start()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_audit_log(
    NEW.user_id,
    'start_analysis',
    'ai_job',
    NEW.id,
    jsonb_build_object(
      'case_id', NEW.case_id,
      'model', NEW.model
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for job creation
DROP TRIGGER IF EXISTS job_creation_audit ON ai_jobs;
CREATE TRIGGER job_creation_audit
  AFTER INSERT ON ai_jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_analysis_start();

-- Comments
COMMENT ON TABLE audit_logs IS 'Audit trail for all important user actions';
COMMENT ON COLUMN profiles.role IS 'User role: user or admin';
COMMENT ON MATERIALIZED VIEW mv_analyses_per_user_month IS 'Monthly analysis statistics per user';
COMMENT ON MATERIALIZED VIEW mv_storage_usage_per_user IS 'Total storage usage per user';
