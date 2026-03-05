-- =====================================================
-- Orca Dental AI - Sprint 2: Mock AI Analysis
-- Run this in Supabase Dashboard SQL Editor
-- =====================================================

-- =====================================================
-- 1. UPDATE AI_RESULTS TABLE
-- =====================================================

-- Add new columns for tracking analysis status
ALTER TABLE ai_results 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' 
  CHECK (status IN ('pending', 'processing', 'done', 'failed')),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- =====================================================
-- 2. ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS ai_results_case_id_idx ON ai_results(case_id);
CREATE INDEX IF NOT EXISTS ai_results_status_idx ON ai_results(status);
CREATE INDEX IF NOT EXISTS ai_results_user_status_idx ON ai_results(user_id, status);

-- =====================================================
-- 3. UPDATE RLS POLICIES FOR AI_RESULTS
-- =====================================================

-- Drop existing policies to recreate with updated checks
DROP POLICY IF EXISTS "Users can view own results" ON ai_results;
DROP POLICY IF EXISTS "System can insert results" ON ai_results;
DROP POLICY IF EXISTS "Users can insert own results" ON ai_results;
DROP POLICY IF EXISTS "Users can update own results" ON ai_results;
DROP POLICY IF EXISTS "Users can delete own results" ON ai_results;

-- Users can view only their own results
CREATE POLICY "Users can view own results"
    ON ai_results FOR SELECT
    USING (user_id = auth.uid());

-- Users can insert only their own results
CREATE POLICY "Users can insert own results"
    ON ai_results FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update only their own results
CREATE POLICY "Users can update own results"
    ON ai_results FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can delete only their own results
CREATE POLICY "Users can delete own results"
    ON ai_results FOR DELETE
    USING (user_id = auth.uid());

-- =====================================================
-- 4. CREATE FUNCTION TO GET AVERAGE PROCESSING TIME
-- =====================================================

CREATE OR REPLACE FUNCTION get_avg_processing_time(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    avg_seconds NUMERIC;
BEGIN
    SELECT AVG(EXTRACT(EPOCH FROM (finished_at - started_at)))
    INTO avg_seconds
    FROM ai_results
    WHERE user_id = p_user_id
      AND status = 'done'
      AND started_at IS NOT NULL
      AND finished_at IS NOT NULL;
    
    RETURN COALESCE(avg_seconds, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. CREATE FUNCTION TO COUNT REPORTS READY
-- =====================================================

CREATE OR REPLACE FUNCTION count_reports_ready(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    count_val INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO count_val
    FROM ai_results
    WHERE user_id = p_user_id
      AND status = 'done';
    
    RETURN COALESCE(count_val, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- DONE
-- =====================================================
