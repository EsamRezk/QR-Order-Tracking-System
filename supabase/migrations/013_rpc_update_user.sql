-- ═══════════════════════════════════════════════════
-- 1. Update list_users to include branch_id for edit form
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_list_users_secure(p_session_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user RECORD;
  v_users JSON;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  SELECT json_agg(row_to_json(t))
  INTO v_users
  FROM (
    SELECT u.id, u.username, u.role, u.route, u.branch_id,
           b.name_ar AS branch_name, b.code AS branch_code
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    ORDER BY u.created_at
  ) t;

  RETURN json_build_object('success', true, 'users', COALESCE(v_users, '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════
-- 2. RPC: update_user_secure (admin only)
-- Updates username, branch, route, role, and optionally password
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_update_user_secure(
  p_session_id UUID,
  p_target_user_id UUID,
  p_username TEXT,
  p_password TEXT,        -- empty string = don't change password
  p_branch_id UUID,
  p_route TEXT,
  p_role TEXT
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  IF p_password IS NOT NULL AND p_password != '' THEN
    UPDATE users
    SET username = p_username, password = p_password, branch_id = p_branch_id, route = p_route, role = p_role
    WHERE id = p_target_user_id;
  ELSE
    UPDATE users
    SET username = p_username, branch_id = p_branch_id, route = p_route, role = p_role
    WHERE id = p_target_user_id;
  END IF;

  RETURN json_build_object('success', true);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'اسم المستخدم موجود بالفعل');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
