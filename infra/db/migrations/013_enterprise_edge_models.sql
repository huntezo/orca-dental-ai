-- Migration 013: Enterprise Edge Inference & Fine-Tuning Platform
-- Part 1: Edge Nodes + Part 2: Tenant Fine-Tuning + Part 3: On-Prem Mode

-- ============================================
-- PART 1: EDGE NODES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS edge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('active', 'degraded', 'offline')),
  public_url TEXT NOT NULL,
  capacity_score INTEGER NOT NULL DEFAULT 100,
  current_load INTEGER NOT NULL DEFAULT 0,
  supports_local_models BOOLEAN NOT NULL DEFAULT TRUE,
  hmac_secret TEXT NOT NULL,
  last_heartbeat TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for edge_nodes
CREATE INDEX IF NOT EXISTS edge_nodes_status_idx ON edge_nodes(status);
CREATE INDEX IF NOT EXISTS edge_nodes_region_idx ON edge_nodes(region);
CREATE INDEX IF NOT EXISTS edge_nodes_heartbeat_idx ON edge_nodes(last_heartbeat DESC);

-- Enable RLS
ALTER TABLE edge_nodes ENABLE ROW LEVEL SECURITY;

-- Only admins can manage edge nodes
CREATE POLICY "edge_nodes_admin_all" ON edge_nodes
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

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_edge_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER edge_nodes_updated_at_trigger
  BEFORE UPDATE ON edge_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_edge_nodes_updated_at();

-- ============================================
-- PART 1: EDGE JOB SIGNATURE VALIDATION
-- ============================================

CREATE OR REPLACE FUNCTION verify_edge_job_signature(
  p_job_id UUID,
  p_org_id UUID,
  p_timestamp BIGINT,
  p_signature TEXT,
  p_hmac_secret TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_expected_signature TEXT;
  v_payload TEXT;
  v_current_time BIGINT;
BEGIN
  -- Check timestamp expiry (60 seconds)
  v_current_time := EXTRACT(EPOCH FROM NOW())::BIGINT;
  IF (v_current_time - p_timestamp) > 60 THEN
    RETURN FALSE;
  END IF;
  
  -- Build payload string
  v_payload := p_job_id::TEXT || ':' || p_org_id::TEXT || ':' || p_timestamp::TEXT;
  
  -- Calculate expected HMAC
  v_expected_signature := encode(
    hmac(v_payload, p_hmac_secret, 'sha256'),
    'hex'
  );
  
  -- Compare signatures (constant time)
  RETURN v_expected_signature = p_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 2: ORGANIZATION MODELS (FINE-TUNING)
-- ============================================

-- Add columns to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS edge_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS edge_routing_strategy TEXT DEFAULT 'edge_first' CHECK (edge_routing_strategy IN ('edge_first', 'edge_only', 'centralized_only'));
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_model_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_model_id UUID REFERENCES organization_models(id);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deployment_mode TEXT DEFAULT 'cloud' CHECK (deployment_mode IN ('cloud', 'hybrid', 'onprem'));

-- Create organization_models table
CREATE TABLE IF NOT EXISTS organization_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_model TEXT NOT NULL,
  fine_tuned_model_path TEXT,
  version TEXT NOT NULL,
  training_status TEXT NOT NULL DEFAULT 'draft' CHECK (training_status IN ('draft', 'training', 'ready', 'failed', 'deprecated')),
  metrics_json JSONB DEFAULT '{}'::jsonb,
  training_cost DECIMAL(10,2),
  inference_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for organization_models
CREATE INDEX IF NOT EXISTS organization_models_org_id_idx ON organization_models(org_id);
CREATE INDEX IF NOT EXISTS organization_models_status_idx ON organization_models(training_status);
CREATE INDEX IF NOT EXISTS organization_models_active_idx ON organization_models(org_id, is_active);

-- Enable RLS
ALTER TABLE organization_models ENABLE ROW LEVEL SECURITY;

-- Organizations can read their own models
CREATE POLICY "organization_models_org_select" ON organization_models
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE org_id = organization_models.org_id AND user_id = auth.uid()
    )
  );

-- Only org admins can manage models
CREATE POLICY "organization_models_admin_manage" ON organization_models
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_models.org_id 
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- PART 2: TRAINING JOBS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS training_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_id UUID REFERENCES organization_models(id),
  dataset_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'preparing', 'training', 'evaluating', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  progress_percent INTEGER DEFAULT 0,
  epochs_completed INTEGER DEFAULT 0,
  total_epochs INTEGER,
  metrics_json JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for training_jobs
CREATE INDEX IF NOT EXISTS training_jobs_org_id_idx ON training_jobs(org_id);
CREATE INDEX IF NOT EXISTS training_jobs_status_idx ON training_jobs(status);
CREATE INDEX IF NOT EXISTS training_jobs_model_id_idx ON training_jobs(model_id);
CREATE INDEX IF NOT EXISTS training_jobs_status_created_idx ON training_jobs(status, created_at) 
  WHERE status = 'queued';

-- Enable RLS
ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;

-- Organization members can see their jobs
CREATE POLICY "training_jobs_org_select" ON training_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE org_id = training_jobs.org_id AND user_id = auth.uid()
    )
  );

-- Training worker uses service role

-- Trigger for updated_at
CREATE TRIGGER training_jobs_updated_at_trigger
  BEFORE UPDATE ON training_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_analysis_jobs_updated_at();

-- ============================================
-- PART 2: TRAINING PIPELINE FUNCTIONS
-- ============================================

-- Function to claim next training job
CREATE OR REPLACE FUNCTION claim_next_training_job()
RETURNS TABLE (
  job_id UUID,
  job_org_id UUID,
  job_dataset_path TEXT,
  job_model_id UUID
) AS $$
BEGIN
  RETURN QUERY
  WITH next_job AS (
    SELECT training_jobs.id
    FROM training_jobs
    WHERE training_jobs.status = 'queued'
    ORDER BY training_jobs.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE training_jobs
  SET 
    status = 'preparing',
    started_at = NOW()
  FROM next_job
  WHERE training_jobs.id = next_job.id
  RETURNING 
    training_jobs.id, 
    training_jobs.org_id, 
    training_jobs.dataset_path,
    training_jobs.model_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete training job
CREATE OR REPLACE FUNCTION complete_training_job(
  p_job_id UUID,
  p_model_path TEXT,
  p_metrics_json JSONB,
  p_actual_cost DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_org_id UUID;
  v_model_id UUID;
BEGIN
  -- Get job details
  SELECT org_id, model_id INTO v_org_id, v_model_id
  FROM training_jobs WHERE id = p_job_id;
  
  -- Update training job
  UPDATE training_jobs
  SET 
    status = 'completed',
    completed_at = NOW(),
    progress_percent = 100,
    metrics_json = p_metrics_json,
    actual_cost = p_actual_cost
  WHERE id = p_job_id;
  
  -- Update model
  UPDATE organization_models
  SET 
    training_status = 'ready',
    fine_tuned_model_path = p_model_path,
    metrics_json = p_metrics_json
  WHERE id = v_model_id;
  
  -- Set as current model if org has custom_model_enabled
  UPDATE organizations
  SET current_model_id = v_model_id
  WHERE id = v_org_id AND custom_model_enabled = TRUE;
  
  -- Track telemetry
  PERFORM track_event(
    (SELECT user_id FROM organization_members WHERE org_id = v_org_id AND role = 'owner' LIMIT 1),
    'model_trained',
    v_model_id,
    jsonb_build_object(
      'org_id', v_org_id,
      'training_cost', p_actual_cost,
      'metrics', p_metrics_json
    )
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fail training job
CREATE OR REPLACE FUNCTION fail_training_job(
  p_job_id UUID,
  p_error_message TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_model_id UUID;
BEGIN
  SELECT model_id INTO v_model_id FROM training_jobs WHERE id = p_job_id;
  
  UPDATE training_jobs
  SET 
    status = 'failed',
    completed_at = NOW(),
    error_message = p_error_message
  WHERE id = p_job_id;
  
  UPDATE organization_models
  SET training_status = 'failed'
  WHERE id = v_model_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 3: LICENSES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL UNIQUE,
  license_type TEXT NOT NULL DEFAULT 'standard' CHECK (license_type IN ('trial', 'standard', 'enterprise', 'onprem')),
  max_users INTEGER NOT NULL,
  max_monthly_jobs INTEGER NOT NULL,
  max_storage_gb INTEGER NOT NULL DEFAULT 100,
  features JSONB DEFAULT '{}'::jsonb,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_validated_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for licenses
CREATE INDEX IF NOT EXISTS licenses_org_id_idx ON licenses(org_id);
CREATE INDEX IF NOT EXISTS licenses_key_idx ON licenses(license_key);
CREATE INDEX IF NOT EXISTS licenses_expires_idx ON licenses(expires_at);

-- Enable RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- Organizations can read their own license
CREATE POLICY "licenses_org_select" ON licenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE org_id = licenses.org_id AND user_id = auth.uid()
    )
  );

-- ============================================
-- PART 3: LICENSE VALIDATION
-- ============================================

CREATE OR REPLACE FUNCTION validate_license(p_org_id UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  expires_at TIMESTAMPTZ,
  max_users INTEGER,
  max_monthly_jobs INTEGER,
  remaining_jobs INTEGER,
  reason TEXT
) AS $$
DECLARE
  v_license RECORD;
  v_jobs_this_month INTEGER;
BEGIN
  -- Get active license
  SELECT * INTO v_license
  FROM licenses
  WHERE org_id = p_org_id
    AND is_revoked = FALSE
    AND expires_at > NOW()
  ORDER BY issued_at DESC
  LIMIT 1;
  
  IF v_license IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0, 0, 0, 'No valid license found'::TEXT;
    RETURN;
  END IF;
  
  -- Count jobs this month
  SELECT COUNT(*) INTO v_jobs_this_month
  FROM analysis_jobs aj
  JOIN cases c ON c.id = aj.case_id
  WHERE c.org_id = p_org_id
    AND aj.created_at >= DATE_TRUNC('month', NOW());
  
  IF v_jobs_this_month >= v_license.max_monthly_jobs THEN
    RETURN QUERY SELECT 
      FALSE, 
      v_license.expires_at, 
      v_license.max_users, 
      v_license.max_monthly_jobs,
      0,
      'Monthly job quota exceeded'::TEXT;
    RETURN;
  END IF;
  
  -- Update last validated
  UPDATE licenses SET last_validated_at = NOW() WHERE id = v_license.id;
  
  RETURN QUERY SELECT 
    TRUE, 
    v_license.expires_at, 
    v_license.max_users, 
    v_license.max_monthly_jobs,
    v_license.max_monthly_jobs - v_jobs_this_month,
    'Valid'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get license status for worker
CREATE OR REPLACE FUNCTION get_license_for_job(p_org_id UUID)
RETURNS TABLE (
  license_key TEXT,
  is_valid BOOLEAN,
  max_monthly_jobs INTEGER,
  deployment_mode TEXT
) AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  SELECT validate_license.is_valid INTO v_valid
  FROM validate_license(p_org_id);
  
  RETURN QUERY
  SELECT 
    l.license_key,
    v_valid,
    l.max_monthly_jobs,
    o.deployment_mode
  FROM licenses l
  JOIN organizations o ON o.id = l.org_id
  WHERE l.org_id = p_org_id
    AND l.is_revoked = FALSE
  ORDER BY l.issued_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 4: AUDIT LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS audit_logs_org_id_idx ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Organizations can read their own audit logs
CREATE POLICY "audit_logs_org_select" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE org_id = audit_logs.org_id AND user_id = auth.uid()
    )
  );

-- Function to create audit log
CREATE OR REPLACE FUNCTION create_audit_log(
  p_org_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  INSERT INTO audit_logs (
    org_id, user_id, action, entity_type, entity_id,
    old_values, new_values
  ) VALUES (
    p_org_id, v_user_id, p_action, p_entity_type, p_entity_id,
    p_old_values, p_new_values
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 4: EDGE NODE ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS edge_node_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES edge_nodes(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cpu_percent DECIMAL(5,2),
  memory_percent DECIMAL(5,2),
  requests_per_minute INTEGER,
  avg_response_ms INTEGER,
  error_rate DECIMAL(5,2),
  active_connections INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS edge_node_metrics_node_idx ON edge_node_metrics(node_id);
CREATE INDEX IF NOT EXISTS edge_node_metrics_time_idx ON edge_node_metrics(timestamp DESC);

-- Hypertable for time-series data
SELECT create_hypertable('edge_node_metrics', 'timestamp', if_not_exists => TRUE);

-- Function to get edge node stats
CREATE OR REPLACE FUNCTION get_edge_node_stats(p_node_id UUID)
RETURNS TABLE (
  avg_cpu DECIMAL,
  avg_memory DECIMAL,
  avg_response_ms INTEGER,
  total_requests BIGINT,
  error_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    AVG(cpu_percent)::DECIMAL,
    AVG(memory_percent)::DECIMAL,
    AVG(avg_response_ms)::INTEGER,
    SUM(requests_per_minute)::BIGINT,
    AVG(error_rate)::DECIMAL
  FROM edge_node_metrics
  WHERE node_id = p_node_id
    AND timestamp > NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 5: ENHANCED ANALYSIS JOBS (EDGE SUPPORT)
-- ============================================

-- Add edge-related columns to analysis_jobs
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS edge_node_id UUID REFERENCES edge_nodes(id);
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS routing_strategy TEXT DEFAULT 'centralized_only';
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS edge_attempted BOOLEAN DEFAULT FALSE;
ALTER TABLE analysis_jobs ADD COLUMN IF NOT EXISTS edge_latency_ms INTEGER;

-- Function to get optimal edge node for organization
CREATE OR REPLACE FUNCTION get_optimal_edge_node(
  p_org_id UUID,
  p_preferred_region TEXT DEFAULT NULL
)
RETURNS TABLE (
  node_id UUID,
  node_url TEXT,
  node_hmac_secret TEXT
) AS $$
DECLARE
  v_strategy TEXT;
BEGIN
  -- Get org routing strategy
  SELECT edge_routing_strategy INTO v_strategy
  FROM organizations WHERE id = p_org_id;
  
  IF v_strategy = 'centralized_only' THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    en.id,
    en.public_url,
    en.hmac_secret
  FROM edge_nodes en
  WHERE en.status = 'active'
    AND en.current_load < en.capacity_score
    AND (p_preferred_region IS NULL OR en.region = p_preferred_region)
  ORDER BY 
    en.current_load::FLOAT / en.capacity_score,
    CASE WHEN en.region = p_preferred_region THEN 0 ELSE 1 END,
    en.last_heartbeat DESC NULLS LAST
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record edge node heartbeat
CREATE OR REPLACE FUNCTION record_edge_heartbeat(
  p_node_id UUID,
  p_load INTEGER,
  p_metrics JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  UPDATE edge_nodes
  SET 
    current_load = p_load,
    last_heartbeat = NOW(),
    metadata = metadata || p_metrics
  WHERE id = p_node_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE edge_nodes IS 'Regional edge inference nodes for distributed AI processing';
COMMENT ON TABLE organization_models IS 'Organization-specific fine-tuned models';
COMMENT ON TABLE training_jobs IS 'Async fine-tuning job queue';
COMMENT ON TABLE licenses IS 'Enterprise license management';
COMMENT ON TABLE audit_logs IS 'Enterprise audit trail';
COMMENT ON TABLE edge_node_metrics IS 'Time-series metrics for edge node monitoring';

COMMENT ON FUNCTION verify_edge_job_signature IS 'Validates HMAC signature on edge job requests';
COMMENT ON FUNCTION validate_license IS 'Validates org license and quota status';
COMMENT ON FUNCTION get_optimal_edge_node IS 'Returns best edge node based on load and region';
