-- ═══════════════════════════════════════════════════
-- Sessions never expire — user stays logged in until
-- explicit logout (removes the 12h idle timeout)
-- ═══════════════════════════════════════════════════

-- 1. New sessions: effectively no expiry
ALTER TABLE user_sessions
  ALTER COLUMN expires_at SET DEFAULT now() + interval '10 years';

-- 2. Extend all existing sessions so active users aren't kicked out
UPDATE user_sessions
SET expires_at = now() + interval '10 years';

-- 3. get_session_user: drop the 12h sliding-window refresh (from 010),
--    keep the expiry check for safety (10y horizon)
CREATE OR REPLACE FUNCTION get_session_user(p_session_id UUID)
RETURNS TABLE(user_id UUID, role TEXT, branch_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.role, u.branch_id
  FROM user_sessions s
  JOIN users u ON s.user_id = u.id
  WHERE s.id = p_session_id AND s.expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
