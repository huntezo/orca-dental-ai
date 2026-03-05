-- Migration 009: Private Beta Allowlist
-- Controls who can register during private beta period

-- ============================================
-- BETA ALLOWLIST TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS beta_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  -- Track if user has registered
  registered_at TIMESTAMPTZ,
  registered_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS beta_allowlist_email_idx ON beta_allowlist(email);
CREATE INDEX IF NOT EXISTS beta_allowlist_created_at_idx ON beta_allowlist(created_at DESC);
CREATE INDEX IF NOT EXISTS beta_allowlist_invited_by_idx ON beta_allowlist(invited_by);

-- Enable RLS
ALTER TABLE beta_allowlist ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage allowlist
CREATE POLICY "beta_allowlist_admin_select" ON beta_allowlist
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "beta_allowlist_admin_insert" ON beta_allowlist
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "beta_allowlist_admin_delete" ON beta_allowlist
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role can do everything (for Edge Functions)
CREATE POLICY "beta_allowlist_service_all" ON beta_allowlist
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- ============================================
-- BETA CHECK FUNCTIONS
-- ============================================

-- Function to check if email is in allowlist
CREATE OR REPLACE FUNCTION check_beta_allowlist(p_email TEXT)
RETURNS TABLE (
  allowed BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_exists BOOLEAN;
  v_registered BOOLEAN;
BEGIN
  -- Normalize email
  p_email := LOWER(TRIM(p_email));
  
  -- Check if email exists in allowlist
  SELECT EXISTS(
    SELECT 1 FROM beta_allowlist 
    WHERE email = p_email
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RETURN QUERY SELECT 
      FALSE, 
      'This email is not on the beta allowlist. Please contact us for early access.'::TEXT;
    RETURN;
  END IF;
  
  -- Check if already registered
  SELECT registered_user_id IS NOT NULL 
  INTO v_registered
  FROM beta_allowlist 
  WHERE email = p_email;
  
  IF v_registered THEN
    RETURN QUERY SELECT 
      FALSE, 
      'This email has already been registered. Please sign in instead.'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, 'Email is approved for beta registration.'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark allowlist entry as registered
CREATE OR REPLACE FUNCTION mark_beta_registered(
  p_email TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE beta_allowlist
  SET 
    registered_at = NOW(),
    registered_user_id = p_user_id
  WHERE email = LOWER(TRIM(p_email));
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add email to allowlist (admin only)
CREATE OR REPLACE FUNCTION add_to_beta_allowlist(
  p_email TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_admin_role TEXT;
  v_id UUID;
BEGIN
  -- Check if caller is admin
  SELECT role INTO v_admin_role FROM profiles WHERE id = auth.uid();
  
  IF v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can add to beta allowlist';
  END IF;
  
  INSERT INTO beta_allowlist (email, invited_by, note)
  VALUES (LOWER(TRIM(p_email)), auth.uid(), p_note)
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove email from allowlist (admin only)
CREATE OR REPLACE FUNCTION remove_from_beta_allowlist(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin_role TEXT;
BEGIN
  -- Check if caller is admin
  SELECT role INTO v_admin_role FROM profiles WHERE id = auth.uid();
  
  IF v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can remove from beta allowlist';
  END IF;
  
  DELETE FROM beta_allowlist WHERE email = LOWER(TRIM(p_email));
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- BETA METRICS
-- ============================================

-- Function to get beta signup stats
CREATE OR REPLACE FUNCTION get_beta_stats()
RETURNS TABLE (
  total_invited BIGINT,
  total_registered BIGINT,
  remaining_slots BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM beta_allowlist) AS total_invited,
    (SELECT COUNT(*) FROM beta_allowlist WHERE registered_user_id IS NOT NULL) AS total_registered,
    (SELECT COUNT(*) FROM beta_allowlist WHERE registered_user_id IS NULL) AS remaining_slots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- AUTO-UPDATE ON USER REGISTRATION
-- ============================================

-- Trigger function to auto-mark allowlist when user registers
CREATE OR REPLACE FUNCTION auto_mark_beta_registered()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to mark the email as registered
  UPDATE beta_allowlist
  SET 
    registered_at = NOW(),
    registered_user_id = NEW.id
  WHERE 
    email = LOWER(NEW.email)
    AND registered_user_id IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
-- Note: This requires appropriate permissions on auth schema
-- If not possible, we'll handle this in application code
-- DROP TRIGGER IF EXISTS auto_beta_registration ON auth.users;
-- CREATE TRIGGER auto_beta_registration
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_mark_beta_registered();

-- ============================================
-- SEED DATA (Optional - add initial beta testers)
-- ============================================

-- Example: Add admin emails (uncomment and modify as needed)
-- INSERT INTO beta_allowlist (email, note)
-- VALUES 
--   ('admin@example.com', 'Initial admin'),
--   ('doctor1@example.com', 'Beta doctor 1')
-- ON CONFLICT (email) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE beta_allowlist IS 'Email allowlist for private beta registration';
COMMENT ON COLUMN beta_allowlist.email IS 'Email address allowed to register during beta';
COMMENT ON COLUMN beta_allowlist.invited_by IS 'Admin who invited this user';
COMMENT ON COLUMN beta_allowlist.registered_user_id IS 'Links to auth.users once registered';
COMMENT ON FUNCTION check_beta_allowlist IS 'Checks if email can register during beta';
COMMENT ON FUNCTION add_to_beta_allowlist IS 'Admin function to add email to allowlist';
