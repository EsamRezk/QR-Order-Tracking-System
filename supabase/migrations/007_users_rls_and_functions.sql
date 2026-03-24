-- ═══════════════════════════════════════════════════
-- RLS: Block all direct access to users table
-- ═══════════════════════════════════════════════════
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- No policies = no direct access from client

-- ═══════════════════════════════════════════════════
-- RPC: authenticate_user (login)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION authenticate_user(p_username TEXT, p_password TEXT)
RETURNS JSON AS $$
DECLARE
  v_user RECORD;
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

  RETURN json_build_object(
    'success', true,
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
-- RPC: create_user (admin only)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_user(
  p_admin_id UUID,
  p_username TEXT,
  p_password TEXT,
  p_branch_id UUID,
  p_route TEXT,
  p_role TEXT
)
RETURNS JSON AS $$
DECLARE
  v_admin RECORD;
  v_new_user RECORD;
BEGIN
  -- Verify caller is admin
  SELECT role INTO v_admin FROM users WHERE id = p_admin_id;
  IF v_admin IS NULL OR v_admin.role != 'admin' THEN
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

-- ═══════════════════════════════════════════════════
-- RPC: delete_user (admin only)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION delete_user(p_admin_id UUID, p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_admin RECORD;
BEGIN
  SELECT role INTO v_admin FROM users WHERE id = p_admin_id;
  IF v_admin IS NULL OR v_admin.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Prevent admin from deleting themselves
  IF p_admin_id = p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'لا يمكنك حذف حسابك');
  END IF;

  DELETE FROM users WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════
-- RPC: list_users (admin only, no passwords returned)
-- ═══════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION list_users(p_admin_id UUID)
RETURNS JSON AS $$
DECLARE
  v_admin RECORD;
  v_users JSON;
BEGIN
  SELECT role INTO v_admin FROM users WHERE id = p_admin_id;
  IF v_admin IS NULL OR v_admin.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  SELECT json_agg(row_to_json(t))
  INTO v_users
  FROM (
    SELECT u.id, u.username, u.role, u.route,
           b.name_ar AS branch_name, b.code AS branch_code
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    ORDER BY u.created_at
  ) t;

  RETURN json_build_object('success', true, 'users', COALESCE(v_users, '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
