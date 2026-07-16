-- ═══════════════════════════════════════════════════════════════════
-- 032: المزامنة الخلفية لفوديكس (Optimistic UI + Retry Sweeper)
-- ═══════════════════════════════════════════════════════════════════
-- الهدف: زر "جاهز"/"تم التسليم" يحدّث القاعدة فوراً (داتابيز أولاً)،
-- ونداء فوديكس (PUT) يتم في الخلفية مع إعادة محاولة مضمونة:
--
--   المسار السريع : Edge Function ترد بعد الـ RPC مباشرة ثم تنفّذ الـ PUT
--                    في الخلفية (EdgeRuntime.waitUntil) — فوديكس خلال ثوانٍ.
--   شبكة الأمان   : pg_cron كل 30 ثانية → pg_net → action 'resync' في
--                    foodics-update-status تلتقط كل synced_to_foodics=false
--                    وتعيد المحاولة بتباعد تصاعدي (30s→1m→2m→4m→8m، سقف 8m)
--                    حتى 20 محاولة (~ساعتان ونصف تغطية لانقطاع فوديكس).
--
-- جدول orders نفسه هو "الطابور" (transactional outbox):
--   synced_to_foodics=false  = مهمة معلقة (تُكتب في نفس ترانزاكشن تغيير الحالة)
--   foodics_delivery_status  = القيمة المطلوب إرسالها بالضبط (2 أو 5) — آخر
--                              حالة فقط تُرسل تلقائياً (coalescing مجاني).
--
-- أمان: p_synced في الـ RPCs العامة صار مُتجاهَلاً (كان يسمح لأي عميل بتزييف
-- علم المزامنة). رفعُ العلم صار حكراً على service_role (الدوال أدناه + webhook).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) أعمدة تتبّع إعادة المحاولة ──────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS foodics_sync_attempts SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS foodics_sync_next_at  TIMESTAMPTZ NOT NULL DEFAULT now();

-- فهرس جزئي صغير: الـ sweeper (وحارس الجدولة) لا يمسّان إلا الصفوف المعلقة
CREATE INDEX IF NOT EXISTS idx_orders_foodics_unsynced
  ON orders (foodics_sync_next_at)
  WHERE synced_to_foodics = false AND source = 'foodics';

-- ── 2) تحييد p_synced في RPCs المطبخ (نفس التوقيعات — توافق كامل) ──
-- الحالة المحلية تتغير فوراً، والمزامنة تبدأ دائماً "معلقة" بعدّاد صفر.

-- زر "جاهز": preparing → ready
CREATE OR REPLACE FUNCTION rpc_kitchen_mark_ready_synced(
  p_session_id        UUID,
  p_order_internal_id UUID,
  p_device_info       TEXT,
  p_synced            BOOLEAN DEFAULT false   -- مُتجاهَل (محفوظ للتوافق فقط)
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role NOT IN ('admin', 'user') THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  UPDATE orders
  SET status                  = 'ready',
      ready_at                = now(),
      foodics_delivery_status = 2,
      synced_to_foodics       = false,  -- تُرفع فقط من service_role بعد نجاح PUT
      foodics_sync_attempts   = 0,
      foodics_sync_next_at    = now()
  WHERE id = p_order_internal_id AND status = 'preparing';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الطلب غير متاح للتحويل لجاهز');
  END IF;

  INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
  VALUES (p_order_internal_id, 'ready_scan', v_user.user_id::TEXT, p_device_info);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- زر "تم التسليم": ready → completed
CREATE OR REPLACE FUNCTION rpc_kitchen_mark_delivered(
  p_session_id        UUID,
  p_order_internal_id UUID,
  p_device_info       TEXT,
  p_synced            BOOLEAN DEFAULT false   -- مُتجاهَل (محفوظ للتوافق فقط)
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role NOT IN ('admin', 'user') THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  UPDATE orders
  SET status                  = 'completed',
      delivered_at            = now(),
      completed_at            = now(),
      foodics_delivery_status = 5,
      synced_to_foodics       = false,
      foodics_sync_attempts   = 0,
      foodics_sync_next_at    = now()
  WHERE id = p_order_internal_id AND status = 'ready';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الطلب غير متاح للتسليم');
  END IF;

  INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
  VALUES (p_order_internal_id, 'delivered', v_user.user_id::TEXT, p_device_info);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- سلة الحذف (تحويل جماعي): نفس المنطق + تصفير عدّادات المزامنة
CREATE OR REPLACE FUNCTION rpc_kitchen_bulk_deliver(
  p_session_id  UUID,
  p_branch_id   UUID,
  p_scope       TEXT,               -- 'preparing' | 'ready' | 'both'
  p_device_info TEXT DEFAULT 'kitchen'
) RETURNS JSON AS $$
DECLARE
  v_user     RECORD;
  v_statuses TEXT[];
  v_orders   JSON;
  v_count    INTEGER;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role NOT IN ('admin', 'user') THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  IF p_scope NOT IN ('preparing', 'ready', 'both') THEN
    RETURN json_build_object('success', false, 'error', 'نطاق غير صحيح');
  END IF;

  v_statuses := CASE p_scope
    WHEN 'preparing' THEN ARRAY['preparing']
    WHEN 'ready'     THEN ARRAY['ready']
    ELSE                  ARRAY['preparing', 'ready']
  END;

  WITH updated AS (
    UPDATE orders
    SET status                  = 'completed',
        delivered_at            = now(),
        completed_at            = now(),
        ready_at                = COALESCE(ready_at, now()),
        foodics_delivery_status = 5,
        synced_to_foodics       = false,
        foodics_sync_attempts   = 0,
        foodics_sync_next_at    = now()
    WHERE branch_id = p_branch_id
      AND status = ANY(v_statuses)
    RETURNING id, source, foodics_order_id
  ),
  logged AS (
    INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
    SELECT id, 'delivered', v_user.user_id::TEXT, p_device_info FROM updated
  )
  SELECT
    COUNT(*),
    COALESCE(
      json_agg(json_build_object(
        'id', id,
        'source', source,
        'foodics_order_id', foodics_order_id
      )),
      '[]'::json
    )
  INTO v_count, v_orders
  FROM updated;

  RETURN json_build_object('success', true, 'count', v_count, 'orders', v_orders);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3) دوال bookkeeping ذرّية — service_role فقط ────────────────────
-- ترفع علم المزامنة بشرط أن تكون الحالة المرسلة هي ما زالت الحالة الحالية
-- (لو الطلب تقدّم لحالة أحدث أثناء الـ PUT، تفشل الحراسة ويتولاه sweep تالٍ).
CREATE OR REPLACE FUNCTION fn_foodics_sync_mark_synced(
  p_order_id        UUID,
  p_delivery_status INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE orders
  SET synced_to_foodics = true
  WHERE id = p_order_id
    AND foodics_delivery_status = p_delivery_status
    AND synced_to_foodics = false;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تسجيل فشل محاولة: عدّاد + الموعد التالي بتباعد تصاعدي (سقف 8 دقائق).
-- p_permanent (مثل 404: الطلب غير موجود في فوديكس) → إخراج فوري من الطابور
-- مع الإبقاء على synced=false كي يبقى الصف قابلاً للاستعلام (dead-letter).
CREATE OR REPLACE FUNCTION fn_foodics_sync_fail(
  p_order_id  UUID,
  p_permanent BOOLEAN DEFAULT false
) RETURNS VOID AS $$
BEGIN
  UPDATE orders
  SET foodics_sync_attempts = CASE WHEN p_permanent THEN 32767
                                   ELSE foodics_sync_attempts + 1 END,
      -- الأس مقصوص عند 8 (= سقف الـ 8 دقائق): يمنع power(2, 32767)=Infinity
      -- ⇒ "interval out of range" لو استُدعيت الدالة على صف مُخرَج نهائياً.
      foodics_sync_next_at  = now() + LEAST(
        interval '30 seconds' * power(2, LEAST(foodics_sync_attempts, 8)),
        interval '8 minutes'
      )
  WHERE id = p_order_id AND synced_to_foodics = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- الوصول: service_role فقط (الواجهة لا تلمس علم المزامنة إطلاقاً)
REVOKE EXECUTE ON FUNCTION fn_foodics_sync_mark_synced(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION fn_foodics_sync_fail(UUID, BOOLEAN)        FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_foodics_sync_mark_synced(UUID, INTEGER) TO service_role;
GRANT  EXECUTE ON FUNCTION fn_foodics_sync_fail(UUID, BOOLEAN)        TO service_role;

-- ── 4) جدولة الـ sweeper (pg_cron + pg_net) ─────────────────────────
-- ⚠️ إعداد لمرة واحدة لكل مشروع (تيست/برودكشن) قبل تفعيل الجدولة — في SQL Editor:
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'kz_project_url');
--   select vault.create_secret('<سر عشوائي طويل>',                  'kz_resync_secret');
-- ونفس السر في بيئة الـ Edge Function:
--   npx supabase secrets set FOODICS_RESYNC_SECRET=<نفس السر> --project-ref <REF>
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $do$
DECLARE
  -- WHERE EXISTS: لا نستدعي الـ Edge Function إلا عند وجود شغل معلق فعلاً
  -- (يستخدم الفهرس الجزئي — تكلفة الفحص شبه معدومة، ولا استدعاءات فارغة).
  v_cmd TEXT := $sql$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kz_project_url')
             || '/functions/v1/foodics-update-status',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-resync-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kz_resync_secret')
      ),
      body := '{"action":"resync"}'::jsonb,
      timeout_milliseconds := 10000
    )
    WHERE EXISTS (
      SELECT 1 FROM orders
      WHERE synced_to_foodics = false
        AND source = 'foodics'
        AND foodics_order_id IS NOT NULL
        AND status IN ('ready', 'completed')
        AND foodics_sync_attempts < 20
        AND foodics_sync_next_at <= now()
    )
  $sql$;
BEGIN
  -- إعادة الجدولة بأمان لو كانت موجودة
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'foodics-resync') THEN
    PERFORM cron.unschedule('foodics-resync');
  END IF;
  BEGIN
    PERFORM cron.schedule('foodics-resync', '30 seconds', v_cmd);
  EXCEPTION WHEN OTHERS THEN
    -- pg_cron أقدم من 1.5 لا يدعم جدولة بالثواني → كل دقيقة
    PERFORM cron.schedule('foodics-resync', '* * * * *', v_cmd);
  END;
END
$do$;

-- ── استعلام مراقبة (للمرجع — الطلبات العالقة/المستنفدة) ─────────────
-- SELECT id, order_id, status, foodics_delivery_status, foodics_sync_attempts,
--        foodics_sync_next_at
-- FROM orders
-- WHERE synced_to_foodics = false AND source = 'foodics'
--   AND status IN ('ready','completed')
-- ORDER BY foodics_sync_next_at;
