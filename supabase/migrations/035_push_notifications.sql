-- ═══════════════════════════════════════════════════════════════════
-- 035: تنبيهات الموبايل (Web Push) — طلب جديد يصل حتى والتطبيق مقفول
-- ═══════════════════════════════════════════════════════════════════
-- الفكرة: كل جهاز يفعّل التنبيهات من شاشة الفرع يُسجَّل في push_subscriptions
-- مربوطاً بالفرع المفتوح. عند إنشاء طلب جديد في foodics-webhook يُرسَل
-- تنبيه لكل أجهزة ذلك الفرع (راجع supabase/functions/_shared/push.ts).
--
-- المفاتيح (VAPID) في push_config بنفس نمط foodics_config: جدول بلا policies
-- → لا يقرؤه إلا service_role (الـ Edge Functions). المفتاح العام نسخته أيضاً
-- في الواجهة (src/config/push.js) لأنه عام بطبيعته.
-- ⚠️ قيم المفاتيح لا تُكتب في هذه الترحيلة (المستودع) — تُدخَل يدوياً:
--    INSERT INTO push_config (vapid_public_key, vapid_private_key) VALUES (...);

-- 1) مفاتيح VAPID (صف واحد فقط)
CREATE TABLE IF NOT EXISTS push_config (
  id                smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vapid_public_key  text NOT NULL,
  vapid_private_key text NOT NULL,
  subject           text NOT NULL DEFAULT 'https://orders.kebbazone.com',
  updated_at        timestamptz DEFAULT now()
);
ALTER TABLE push_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON push_config FROM anon, authenticated;

-- 2) اشتراكات الأجهزة — جهاز واحد (endpoint) = صف واحد، يتبع آخر فرع فُعِّل منه
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE,
  branch_id     uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  user_agent    text,
  created_at    timestamptz DEFAULT now(),
  last_seen_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_branch ON push_subscriptions (branch_id);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON push_subscriptions FROM anon, authenticated;

-- 3) حفظ/تحديث اشتراك جهاز (من زر "التنبيهات" في شاشة الفرع)
--    مستخدم الفرع (role=user) مقيّد بفرعه؛ المدير أي فرع.
CREATE OR REPLACE FUNCTION rpc_save_push_subscription(
  p_session_id uuid,
  p_branch_id  uuid,
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role NOT IN ('admin', 'user') THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  IF v_user.role = 'user' AND v_user.branch_id IS NOT NULL AND v_user.branch_id <> p_branch_id THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  IF p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL
     OR NOT EXISTS (SELECT 1 FROM branches WHERE id = p_branch_id) THEN
    RETURN json_build_object('success', false, 'error', 'بيانات الاشتراك غير مكتملة');
  END IF;

  INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id, branch_id, user_agent)
  VALUES (p_endpoint, p_p256dh, p_auth, v_user.user_id, p_branch_id, left(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE SET
    p256dh       = EXCLUDED.p256dh,
    auth         = EXCLUDED.auth,
    user_id      = EXCLUDED.user_id,
    branch_id    = EXCLUDED.branch_id,
    user_agent   = EXCLUDED.user_agent,
    last_seen_at = now();

  RETURN json_build_object('success', true);
END $$;

-- 4) إلغاء اشتراك جهاز (زر "إيقاف التنبيهات")
CREATE OR REPLACE FUNCTION rpc_delete_push_subscription(
  p_session_id uuid,
  p_endpoint   text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  DELETE FROM push_subscriptions WHERE endpoint = p_endpoint;
  RETURN json_build_object('success', true);
END $$;

GRANT EXECUTE ON FUNCTION rpc_save_push_subscription(uuid, uuid, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_delete_push_subscription(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
