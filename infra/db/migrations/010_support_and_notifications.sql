-- Migration 010: Support Tickets and Notifications
-- Sprint 10: Beta UX improvements

-- ============================================
-- PART A: SUPPORT TICKETS
-- ============================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'question')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for support tickets
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_type_idx ON support_tickets(type);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can view own tickets
CREATE POLICY "support_tickets_user_select" ON support_tickets
  FOR SELECT 
  USING (user_id = auth.uid());

-- Users can insert own tickets
CREATE POLICY "support_tickets_user_insert" ON support_tickets
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Admins can view all tickets
CREATE POLICY "support_tickets_admin_select" ON support_tickets
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all tickets
CREATE POLICY "support_tickets_admin_update" ON support_tickets
  FOR UPDATE 
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

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS support_tickets_updated_at ON support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_ticket_timestamp();

-- ============================================
-- PART B: NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('analysis', 'report', 'system')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_kind_idx ON notifications(kind);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, is_read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "notifications_user_select" ON notifications
  FOR SELECT 
  USING (user_id = auth.uid());

-- Users can update own notifications (mark as read)
CREATE POLICY "notifications_user_update" ON notifications
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete own notifications
CREATE POLICY "notifications_user_delete" ON notifications
  FOR DELETE 
  USING (user_id = auth.uid());

-- Service role can insert notifications
CREATE POLICY "notifications_service_insert" ON notifications
  FOR INSERT 
  WITH CHECK (true);

-- ============================================
-- PART C: ONBOARDING TRACKING
-- ============================================

-- Add onboarding_completed to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add onboarding_step to track progress
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Add onboarding_completed_at
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ============================================
-- PART D: FUNCTIONS
-- ============================================

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_kind TEXT,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, body, kind, data)
  VALUES (p_user_id, p_title, p_body, p_kind, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE user_id = p_user_id AND is_read = false;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = p_user_id AND is_read = false;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete onboarding
CREATE OR REPLACE FUNCTION complete_onboarding(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE profiles
  SET 
    onboarding_completed = true,
    onboarding_step = 4,
    onboarding_completed_at = NOW()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get support ticket stats (for admin)
CREATE OR REPLACE FUNCTION get_support_ticket_stats()
RETURNS TABLE (
  total_open BIGINT,
  total_in_progress BIGINT,
  total_closed BIGINT,
  bugs_open BIGINT,
  features_open BIGINT,
  questions_open BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') AS total_open,
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'in_progress') AS total_in_progress,
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'closed') AS total_closed,
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'open' AND type = 'bug') AS bugs_open,
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'open' AND type = 'feature') AS features_open,
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'open' AND type = 'question') AS questions_open;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART E: COMMENTS
-- ============================================

COMMENT ON TABLE support_tickets IS 'User support tickets for bug reports, feature requests, and questions';
COMMENT ON TABLE notifications IS 'User notifications for analysis completion, reports, and system events';
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether user has completed the onboarding wizard';
COMMENT ON COLUMN profiles.onboarding_step IS 'Current step in onboarding (0-4)';
