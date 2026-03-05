-- Migration 011: Admin Analytics and Telemetry
-- Sprint 11: Admin triage + analytics + telemetry

-- ============================================
-- PART A: EVENTS TABLE (TELEMETRY)
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'register', 
    'login', 
    'case_created', 
    'file_uploaded', 
    'analysis_started', 
    'analysis_done', 
    'analysis_failed', 
    'pdf_generated', 
    'ticket_created'
  )),
  entity_id UUID,  -- case_id, ticket_id, etc (nullable)
  metadata JSONB DEFAULT '{}'::jsonb,  -- no PHI allowed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS events_user_id_idx ON events(user_id);
CREATE INDEX IF NOT EXISTS events_event_type_idx ON events(event_type);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS events_type_date_idx ON events(event_type, created_at);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "events_user_insert" ON events
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Only admins can read all events
CREATE POLICY "events_admin_select" ON events
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- PART B: SUPPORT TICKET NOTES
-- ============================================

CREATE TABLE IF NOT EXISTS support_ticket_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ticket notes
CREATE INDEX IF NOT EXISTS support_ticket_notes_ticket_id_idx ON support_ticket_notes(ticket_id);
CREATE INDEX IF NOT EXISTS support_ticket_notes_created_at_idx ON support_ticket_notes(created_at DESC);

-- Enable RLS
ALTER TABLE support_ticket_notes ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write ticket notes
CREATE POLICY "support_ticket_notes_admin_all" ON support_ticket_notes
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

-- ============================================
-- PART C: ANALYTICS FUNCTIONS
-- ============================================

-- Function to get user activity stats
CREATE OR REPLACE FUNCTION get_user_activity_stats(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  event_type TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.event_type,
    COUNT(*)::BIGINT
  FROM events e
  WHERE e.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY e.event_type
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily stats
CREATE OR REPLACE FUNCTION get_daily_stats(
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  date DATE,
  new_users BIGINT,
  cases_created BIGINT,
  files_uploaded BIGINT,
  analyses_done BIGINT,
  analyses_failed BIGINT,
  pdfs_generated BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH date_range AS (
    SELECT generate_series(
      CURRENT_DATE - (p_days - 1),
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE AS date
  )
  SELECT 
    dr.date,
    COALESCE((SELECT COUNT(*) FROM events e WHERE e.event_type = 'register' AND DATE(e.created_at) = dr.date), 0)::BIGINT AS new_users,
    COALESCE((SELECT COUNT(*) FROM events e WHERE e.event_type = 'case_created' AND DATE(e.created_at) = dr.date), 0)::BIGINT AS cases_created,
    COALESCE((SELECT COUNT(*) FROM events e WHERE e.event_type = 'file_uploaded' AND DATE(e.created_at) = dr.date), 0)::BIGINT AS files_uploaded,
    COALESCE((SELECT COUNT(*) FROM events e WHERE e.event_type = 'analysis_done' AND DATE(e.created_at) = dr.date), 0)::BIGINT AS analyses_done,
    COALESCE((SELECT COUNT(*) FROM events e WHERE e.event_type = 'analysis_failed' AND DATE(e.created_at) = dr.date), 0)::BIGINT AS analyses_failed,
    COALESCE((SELECT COUNT(*) FROM events e WHERE e.event_type = 'pdf_generated' AND DATE(e.created_at) = dr.date), 0)::BIGINT AS pdfs_generated
  FROM date_range dr
  ORDER BY dr.date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get average processing time
CREATE OR REPLACE FUNCTION get_avg_processing_time(
  p_days INTEGER DEFAULT 7
)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_seconds NUMERIC;
BEGIN
  SELECT AVG(
    EXTRACT(EPOCH FROM (e2.created_at - e1.created_at))
  )::NUMERIC INTO v_avg_seconds
  FROM events e1
  JOIN events e2 ON e1.entity_id = e2.entity_id 
    AND e1.event_type = 'analysis_started' 
    AND e2.event_type = 'analysis_done'
  WHERE e2.created_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN COALESCE(v_avg_seconds, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track event
CREATE OR REPLACE FUNCTION track_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO events (user_id, event_type, entity_id, metadata)
  VALUES (p_user_id, p_event_type, p_entity_id, p_metadata)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add ticket note
CREATE OR REPLACE FUNCTION add_ticket_note(
  p_ticket_id UUID,
  p_note TEXT
)
RETURNS UUID AS $$
DECLARE
  v_admin_id UUID;
  v_admin_role TEXT;
  v_note_id UUID;
BEGIN
  -- Get current user and verify admin
  v_admin_id := auth.uid();
  
  SELECT role INTO v_admin_role 
  FROM profiles 
  WHERE id = v_admin_id;
  
  IF v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can add ticket notes';
  END IF;
  
  INSERT INTO support_ticket_notes (ticket_id, admin_id, note)
  VALUES (p_ticket_id, v_admin_id, p_note)
  RETURNING id INTO v_note_id;
  
  -- Also update ticket status if needed
  UPDATE support_tickets
  SET updated_at = NOW()
  WHERE id = p_ticket_id;
  
  RETURN v_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get ticket with details (admin)
CREATE OR REPLACE FUNCTION get_ticket_details(p_ticket_id UUID)
RETURNS TABLE (
  ticket_id UUID,
  user_id UUID,
  user_email TEXT,
  type TEXT,
  subject TEXT,
  message TEXT,
  page_url TEXT,
  status TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.id,
    st.user_id,
    au.email::TEXT,
    st.type,
    st.subject,
    st.message,
    st.page_url,
    st.status,
    st.admin_notes,
    st.created_at,
    st.updated_at
  FROM support_tickets st
  JOIN auth.users au ON au.id = st.user_id
  WHERE st.id = p_ticket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get ticket notes
CREATE OR REPLACE FUNCTION get_ticket_notes(p_ticket_id UUID)
RETURNS TABLE (
  note_id UUID,
  admin_id UUID,
  admin_email TEXT,
  note TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    stn.id,
    stn.admin_id,
    au.email::TEXT,
    stn.note,
    stn.created_at
  FROM support_ticket_notes stn
  JOIN auth.users au ON au.id = stn.admin_id
  WHERE stn.ticket_id = p_ticket_id
  ORDER BY stn.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART D: COMMENTS
-- ============================================

COMMENT ON TABLE events IS 'Telemetry events for analytics - no PHI allowed in metadata';
COMMENT ON TABLE support_ticket_notes IS 'Internal notes on support tickets - admin only';
COMMENT ON FUNCTION track_event IS 'Tracks a telemetry event';
COMMENT ON FUNCTION get_daily_stats IS 'Returns daily aggregated stats for admin dashboard';
