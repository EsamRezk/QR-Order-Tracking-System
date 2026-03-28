-- ═══════════════════════════════════════════════════
-- Active Sessions — Presence/Heartbeat System
-- ═══════════════════════════════════════════════════

-- 1. Create table
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_page TEXT NOT NULL DEFAULT '/',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_heartbeat ON active_sessions(last_heartbeat);

-- RLS: enabled, no policies = blocked from direct client access
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for live updates on Logs page
ALTER PUBLICATION supabase_realtime ADD TABLE active_sessions;

-- SELECT policy needed for Realtime subscription to work
CREATE POLICY "Read active_sessions" ON active_sessions FOR SELECT USING (true);

-- 2. Upsert heartbeat (any authenticated user)
CREATE OR REPLACE FUNCTION rpc_upsert_heartbeat(
  p_session_id UUID,
  p_current_page TEXT
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'جلسة غير صالحة');
  END IF;

  INSERT INTO active_sessions (user_id, current_page, last_heartbeat)
  VALUES (v_user.user_id, p_current_page, now())
  ON CONFLICT (user_id) DO UPDATE
  SET current_page = EXCLUDED.current_page,
      last_heartbeat = now();

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Remove session (on logout)
CREATE OR REPLACE FUNCTION rpc_remove_presence(p_session_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL THEN
    RETURN json_build_object('success', true);
  END IF;

  DELETE FROM active_sessions WHERE user_id = v_user.user_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Get online users (admin only)
CREATE OR REPLACE FUNCTION rpc_get_online_users(
  p_session_id UUID,
  p_timeout_seconds INTEGER DEFAULT 60
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
  v_result JSON;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  SELECT json_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT
      u.username,
      u.role,
      b.name_ar AS branch_name,
      b.code AS branch_code,
      a.current_page,
      a.last_heartbeat,
      a.started_at
    FROM active_sessions a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN branches b ON u.branch_id = b.id
    WHERE a.last_heartbeat > now() - (p_timeout_seconds || ' seconds')::INTERVAL
    ORDER BY a.last_heartbeat DESC
  ) t;

  RETURN json_build_object('success', true, 'users', COALESCE(v_result, '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
