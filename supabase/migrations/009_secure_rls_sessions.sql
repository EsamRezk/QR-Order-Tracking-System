-- ═══════════════════════════════════════════════════
-- 1. Create Sessions Table
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT now() + interval '12 hours'
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
-- No policies = completely blocked from direct client access

-- ═══════════════════════════════════════════════════
-- 2. Modify authenticate_user to return session_id
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

  -- End old sessions for security (optional but good practice)
  DELETE FROM user_sessions WHERE user_id = v_user.id;

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

-- ═══════════════════════════════════════════════════
-- 3. Helper to validate session and get user info
-- ═══════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════
-- 4. Secure RPCs for Branches (Admin only)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_admin_upsert_branch(
  p_session_id UUID,
  p_id UUID,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_code TEXT,
  p_location_label TEXT
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Verify logic: Only admin
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح للقيام بهذه العملية');
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE branches 
    SET name_ar = p_name_ar, name_en = p_name_en, code = p_code, location_label = p_location_label
    WHERE id = p_id;
  ELSE
    INSERT INTO branches (name_ar, name_en, code, location_label)
    VALUES (p_name_ar, p_name_en, p_code, p_location_label);
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rpc_admin_toggle_branch(p_session_id UUID, p_branch_id UUID, p_is_active BOOLEAN)
RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  UPDATE branches SET is_active = p_is_active WHERE id = p_branch_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════
-- 5. Secure RPCs for Scanner
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_scanner_insert_order(
  p_session_id UUID,
  p_order_id TEXT,
  p_branch_id UUID,
  p_channel_link TEXT,
  p_raw_qr_data JSONB,
  p_device_info TEXT
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
  v_inserted_order RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  -- Both admin and user can scan
  IF v_user IS NULL OR v_user.role NOT IN ('admin', 'user') THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  INSERT INTO orders (order_id, branch_id, channel_link, raw_qr_data, status)
  VALUES (p_order_id, p_branch_id, p_channel_link, p_raw_qr_data, 'preparing')
  RETURNING * INTO v_inserted_order;

  -- Add to scan log
  INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
  VALUES (v_inserted_order.id, 'first_scan', v_user.user_id::TEXT, p_device_info);

  RETURN json_build_object('success', true, 'data', row_to_json(v_inserted_order));
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'الطلب ممسوح مسبقاً (First scan already done)');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rpc_scanner_mark_ready(
  p_session_id UUID,
  p_order_internal_id UUID,
  p_device_info TEXT
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role NOT IN ('admin', 'user') THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  UPDATE orders
  SET status = 'ready', ready_at = now()
  WHERE id = p_order_internal_id AND status = 'preparing';

  -- Add to scan log
  INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
  VALUES (p_order_internal_id, 'second_scan', v_user.user_id::TEXT, p_device_info);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════
-- 6. Secure RPCs for Display
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_display_complete_order(p_session_id UUID, p_order_internal_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  -- screen or admin can complete orders from the display dashboard
  IF v_user IS NULL OR v_user.role NOT IN ('admin', 'screen') THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  UPDATE orders
  SET status = 'completed', completed_at = now()
  WHERE id = p_order_internal_id AND status = 'ready';

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════
-- 7. Update users RPCs to use session_id for authorization
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION rpc_create_user_secure(
  p_session_id UUID,
  p_username TEXT,
  p_password TEXT,
  p_branch_id UUID,
  p_route TEXT,
  p_role TEXT
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
  v_new_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  INSERT INTO users (username, password, branch_id, route, role)
  VALUES (p_username, p_password, p_branch_id, p_route, p_role)
  RETURNING id, username, role INTO v_new_user;

  RETURN json_build_object('success', true, 'user', row_to_json(v_new_user));
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('success', false, 'error', 'اسم المستخدم موجود بالفعل');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rpc_delete_user_secure(p_session_id UUID, p_target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  IF v_user.user_id = p_target_user_id THEN
    RETURN json_build_object('success', false, 'error', 'لا يمكنك حذف حسابك');
  END IF;

  DELETE FROM users WHERE id = p_target_user_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    SELECT u.id, u.username, u.role, u.route, b.name_ar AS branch_name, b.code AS branch_code
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    ORDER BY u.created_at
  ) t;

  RETURN json_build_object('success', true, 'users', COALESCE(v_users, '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════
-- 8. Final RLS Lockdown (Block Anon Writes)
-- ═══════════════════════════════════════════════════
-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all for anon" ON orders;
DROP POLICY IF EXISTS "Allow all for anon" ON scan_logs;
DROP POLICY IF EXISTS "Allow insert branches" ON branches;
DROP POLICY IF EXISTS "Allow update branches" ON branches;

-- Create Secure Policies:
-- SELECT is allowed for all public/anon so pages load correctly.
-- All INSERT/UPDATE/DELETE are NOW BLOCKED from standard client requests and must go through RPCs!
CREATE POLICY "Read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Read scan_logs" ON scan_logs FOR SELECT USING (true);
-- branches read is already enabled (Read branches)
