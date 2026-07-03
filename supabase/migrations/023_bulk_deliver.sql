-- ═══════════════════════════════════════════════════════════════════
-- 023: التحويل الجماعي إلى "تم الاستلام" (سلة الحذف في هيدر شاشة الفرع)
-- ═══════════════════════════════════════════════════════════════════
-- زر السلة في هيدر شاشة الفرع (Kitchen) يحوّل دفعة واحدة:
--   scope='preparing' → كل "قيد التحضير"          → completed
--   scope='ready'     → كل "الجاهز"                → completed
--   scope='both'      → قيد التحضير + الجاهز معاً  → completed
--
-- التحديث المحلي يتم هنا أولاً (فوري للواجهتين عبر Realtime)، وترجع
-- الدالة قائمة الطلبات المتأثرة كي تتولى الـ Edge Function مزامنة
-- فوديكس (PUT delivery_status=5) ثم رفع synced_to_foodics للناجح منها.
-- (نفس قاعدة معالجة الأخطاء: فشل فوديكس لا يوقف المطبخ.)

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

  -- التحديث الجماعي + تسجيل scan_log لكل طلب في عبارة واحدة (atomic)
  WITH updated AS (
    UPDATE orders
    SET status                  = 'completed',
        delivered_at            = now(),
        completed_at            = now(),
        ready_at                = COALESCE(ready_at, now()),
        foodics_delivery_status = 5,
        synced_to_foodics       = false   -- الـ Edge Function ترفعها بعد نجاح PUT فوديكس
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
