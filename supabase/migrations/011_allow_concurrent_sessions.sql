-- ═══════════════════════════════════════════════════
-- Allow Concurrent Sessions
-- Fixes issue where logging into the same account on 
-- a different device (e.g. Phone vs Kitchen Tablet)
-- deletes the other device's session causing "Unauthorized"
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION authenticate_user(p_username TEXT, p_password TEXT)
RETURNS JSON AS $$
DECLARE
  v_user RECORD;
  v_session_id UUID;
BEGIN
  SELECT u.id, u.username, u.role, u.route, u.branch_id,
         b.name_ar AS branch_name, b.code AS branch_code
  INTO v_user
  FROM users u
  LEFT JOIN branches b ON u.branch_id = b.id
  WHERE u.username = p_username
    AND u.password = crypt(p_password, u.password);

  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'اسم المستخدم أو كلمة المرور غير صحيحة');
  END IF;

  -- Clean up ONLY truly expired sessions to keep DB clean, 
  -- instead of deleting ALL active sessions for this user.
  DELETE FROM user_sessions WHERE expires_at <= now() AND user_id = v_user.id;

  -- Create new session for user
  INSERT INTO user_sessions (user_id)
  VALUES (v_user.id)
  RETURNING id INTO v_session_id;

  RETURN json_build_object(
    'success', true,
    'sessionId', v_session_id,
    'user', json_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'role', v_user.role,
      'route', v_user.route,
      'branchId', v_user.branch_id,
      'branch', v_user.branch_name,
      'branchCode', v_user.branch_code
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
