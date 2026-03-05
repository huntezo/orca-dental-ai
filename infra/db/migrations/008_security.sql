-- Migration 008: Medical Compliance & Security Hardening
-- HIPAA-like best practices implementation

-- ============================================
-- PART A: DATA MINIMIZATION VALIDATION
-- ============================================

-- Add constraint to ensure patient_code follows format (no names)
ALTER TABLE cases
ADD CONSTRAINT patient_code_format CHECK (
  patient_code ~ '^[A-Z0-9\-]+$' AND
  length(patient_code) >= 3 AND
  length(patient_code) <= 20
);

-- Create function to validate patient_code (no PII patterns)
CREATE OR REPLACE FUNCTION validate_patient_code(code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check for common name patterns (basic check)
  IF code ~* '(john|jane|doe|smith|patient.*name|name.*patient)' THEN
    RETURN FALSE;
  END IF;
  
  -- Check for email patterns
  IF code ~ '@' THEN
    RETURN FALSE;
  END IF;
  
  -- Check for phone number patterns
  IF code ~ '^\d{3}-\d{3}-\d{4}$' OR code ~ '^\d{10}$' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to validate patient_code on insert/update
CREATE OR REPLACE FUNCTION validate_case_patient_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT validate_patient_code(NEW.patient_code) THEN
    RAISE EXCEPTION 'patient_code contains potential PII. Use anonymized codes only (e.g., P-001, CASE-1234)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_patient_code_trigger ON cases;
CREATE TRIGGER validate_patient_code_trigger
  BEFORE INSERT OR UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION validate_case_patient_code();

-- ============================================
-- PART C: ACCESS LOG RETENTION
-- ============================================

-- Create access_logs table for file downloads and sensitive operations
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,  -- 'file', 'case', 'analysis', etc.
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for access_logs
CREATE INDEX IF NOT EXISTS access_logs_user_id_idx ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS access_logs_action_idx ON access_logs(action);
CREATE INDEX IF NOT EXISTS access_logs_resource_idx ON access_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS access_logs_created_at_idx ON access_logs(created_at DESC);

-- Enable RLS
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view access logs
CREATE POLICY "access_logs_admin_select" ON access_logs
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can view their own access logs
CREATE POLICY "access_logs_user_select_own" ON access_logs
  FOR SELECT 
  USING (user_id = auth.uid());

-- Service role can insert
CREATE POLICY "access_logs_service_insert" ON access_logs
  FOR INSERT 
  WITH CHECK (true);

-- Retention: Auto-delete logs older than 2 years (HIPAA requirement)
CREATE OR REPLACE FUNCTION cleanup_old_access_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM access_logs
  WHERE created_at < NOW() - INTERVAL '2 years';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART D: RATE LIMITING & ACCOUNT LOCKOUT
-- ============================================

-- Create login_attempts table for tracking failed logins
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON login_attempts(email);
CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS login_attempts_created_at_idx ON login_attempts(created_at DESC);

-- No RLS needed - this is for system use only
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "login_attempts_no_access" ON login_attempts
  FOR ALL USING (false);

-- Create account_lockouts table
CREATE TABLE IF NOT EXISTS account_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_lockouts_email_idx ON account_lockouts(email);

-- Function to record login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email TEXT,
  p_ip_address INET,
  p_success BOOLEAN
)
RETURNS TABLE (
  is_locked BOOLEAN,
  locked_until TIMESTAMPTZ,
  remaining_attempts INTEGER
) AS $$
DECLARE
  v_recent_failures INTEGER;
  v_lockout RECORD;
  v_max_attempts INTEGER := 5;
  v_lockout_duration INTERVAL := '30 minutes';
BEGIN
  -- Record the attempt
  INSERT INTO login_attempts (email, ip_address, success)
  VALUES (p_email, p_ip_address, p_success);
  
  -- If successful, clear any lockout
  IF p_success THEN
    DELETE FROM account_lockouts WHERE email = p_email;
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, v_max_attempts;
    RETURN;
  END IF;
  
  -- Count recent failures (last 30 minutes)
  SELECT COUNT(*) INTO v_recent_failures
  FROM login_attempts
  WHERE email = p_email
    AND success = FALSE
    AND created_at > NOW() - v_lockout_duration;
  
  -- Get or create lockout record
  SELECT * INTO v_lockout
  FROM account_lockouts
  WHERE email = p_email;
  
  IF NOT FOUND THEN
    INSERT INTO account_lockouts (email, failed_attempts, last_attempt_at)
    VALUES (p_email, 1, NOW())
    RETURNING * INTO v_lockout;
  ELSE
    UPDATE account_lockouts
    SET failed_attempts = v_recent_failures,
        last_attempt_at = NOW(),
        locked_until = CASE 
          WHEN v_recent_failures >= v_max_attempts THEN NOW() + v_lockout_duration
          ELSE NULL
        END
    WHERE email = p_email
    RETURNING * INTO v_lockout;
  END IF;
  
  -- Check if currently locked
  IF v_lockout.locked_until IS NOT NULL AND v_lockout.locked_until > NOW() THEN
    RETURN QUERY SELECT TRUE, v_lockout.locked_until, 0;
  ELSE
    RETURN QUERY SELECT 
      FALSE, 
      NULL::TIMESTAMPTZ, 
      GREATEST(0, v_max_attempts - v_recent_failures);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION check_account_lockout(p_email TEXT)
RETURNS TABLE (
  is_locked BOOLEAN,
  locked_until TIMESTAMPTZ,
  remaining_attempts INTEGER
) AS $$
DECLARE
  v_lockout RECORD;
  v_recent_failures INTEGER;
  v_max_attempts INTEGER := 5;
  v_lockout_duration INTERVAL := '30 minutes';
BEGIN
  -- Clean up old lockouts
  DELETE FROM account_lockouts 
  WHERE locked_until < NOW();
  
  -- Get lockout record
  SELECT * INTO v_lockout
  FROM account_lockouts
  WHERE email = p_email;
  
  -- Count recent failures
  SELECT COUNT(*) INTO v_recent_failures
  FROM login_attempts
  WHERE email = p_email
    AND success = FALSE
    AND created_at > NOW() - v_lockout_duration;
  
  IF v_lockout.locked_until IS NOT NULL AND v_lockout.locked_until > NOW() THEN
    RETURN QUERY SELECT TRUE, v_lockout.locked_until, 0;
  ELSE
    RETURN QUERY SELECT 
      FALSE, 
      NULL::TIMESTAMPTZ, 
      GREATEST(0, v_max_attempts - v_recent_failures);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old login attempts (retain for 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM login_attempts
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART E: ENCRYPTION DOCUMENTATION
-- ============================================

-- Create table to track encryption metadata
CREATE TABLE IF NOT EXISTS encryption_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  encryption_type TEXT NOT NULL,  -- 'at_rest', 'field_level'
  algorithm TEXT,
  key_rotation_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert documentation of current encryption state
INSERT INTO encryption_metadata (table_name, column_name, encryption_type, algorithm)
VALUES 
  ('all_tables', 'all_columns', 'at_rest', 'AES-256 (Supabase managed)'),
  ('case_files', 'file_path', 'at_rest', 'Storage encryption AES-256'),
  ('audit_logs', 'all_columns', 'at_rest', 'AES-256 (Supabase managed)'),
  ('access_logs', 'all_columns', 'at_rest', 'AES-256 (Supabase managed)')
ON CONFLICT DO NOTHING;

-- ============================================
-- PART F: BACKUP TRACKING
-- ============================================

-- Create backup tracking table
CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL,  -- 'database', 'storage', 'full'
  status TEXT NOT NULL,  -- 'started', 'completed', 'failed'
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  size_bytes BIGINT,
  location TEXT,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id)
);

-- Index for backup queries
CREATE INDEX IF NOT EXISTS backup_logs_status_idx ON backup_logs(status);
CREATE INDEX IF NOT EXISTS backup_logs_created_idx ON backup_logs(started_at DESC);

-- Enable RLS - only admins
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_logs_admin_all" ON backup_logs
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to log backup start
CREATE OR REPLACE FUNCTION log_backup_start(
  p_backup_type TEXT,
  p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_backup_id UUID;
BEGIN
  INSERT INTO backup_logs (backup_type, status, created_by)
  VALUES (p_backup_type, 'started', p_created_by)
  RETURNING id INTO v_backup_id;
  
  RETURN v_backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log backup completion
CREATE OR REPLACE FUNCTION log_backup_complete(
  p_backup_id UUID,
  p_status TEXT,
  p_size_bytes BIGINT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE backup_logs
  SET status = p_status,
      completed_at = NOW(),
      size_bytes = p_size_bytes,
      location = p_location,
      error_message = p_error_message
  WHERE id = p_backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART G: SECURITY AUDIT FUNCTION
-- ============================================

-- Function to get security audit summary
CREATE OR REPLACE FUNCTION get_security_audit_summary()
RETURNS TABLE (
  metric TEXT,
  value TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'Total Users'::TEXT, COUNT(*)::TEXT FROM profiles
  UNION ALL
  SELECT 'Admin Users', COUNT(*)::TEXT FROM profiles WHERE role = 'admin'
  UNION ALL
  SELECT 'Locked Accounts', COUNT(*)::TEXT FROM account_lockouts WHERE locked_until > NOW()
  UNION ALL
  SELECT 'Failed Logins (24h)', COUNT(*)::TEXT FROM login_attempts 
    WHERE success = FALSE AND created_at > NOW() - INTERVAL '24 hours'
  UNION ALL
  SELECT 'Access Logs (30d)', COUNT(*)::TEXT FROM access_logs 
    WHERE created_at > NOW() - INTERVAL '30 days'
  UNION ALL
  SELECT 'Audit Logs (30d)', COUNT(*)::TEXT FROM audit_logs 
    WHERE created_at > NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log access events
CREATE OR REPLACE FUNCTION log_access(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_metadata JSONB,
  p_ip_address INET,
  p_user_agent TEXT,
  p_success BOOLEAN,
  p_error_message TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO access_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent,
    success,
    error_message
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata,
    p_ip_address,
    p_user_agent,
    p_success,
    p_error_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE access_logs IS 'HIPAA-compliant access logging for file downloads and sensitive operations. Retained for 2 years.';
COMMENT ON TABLE login_attempts IS 'Tracks failed login attempts for brute force protection. Retained for 90 days.';
COMMENT ON TABLE account_lockouts IS 'Active account lockouts after failed login attempts';
COMMENT ON TABLE backup_logs IS 'Tracks backup operations for disaster recovery compliance';
COMMENT ON FUNCTION validate_patient_code IS 'Validates that patient_code does not contain PII';
COMMENT ON FUNCTION record_login_attempt IS 'Records login attempts and manages account lockouts';
COMMENT ON FUNCTION log_access IS 'Logs access events for HIPAA compliance';
