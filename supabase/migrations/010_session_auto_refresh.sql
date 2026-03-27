-- ═══════════════════════════════════════════════════
-- Auto-refresh session expiry on every RPC call
-- Fixes: DB session expires after 12h from creation
-- even though user is still active
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_session_user(p_session_id UUID)
RETURNS TABLE(user_id UUID, role TEXT, branch_id UUID) AS $$
BEGIN
  -- Refresh session expiry (slide the window forward)
  UPDATE user_sessions
  SET expires_at = now() + interval '12 hours'
  WHERE id = p_session_id AND expires_at > now();

  RETURN QUERY
  SELECT u.id, u.role, u.branch_id
  FROM user_sessions s
  JOIN users u ON s.user_id = u.id
  WHERE s.id = p_session_id AND s.expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
