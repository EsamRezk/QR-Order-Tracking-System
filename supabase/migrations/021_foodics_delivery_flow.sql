-- ═══════════════════════════════════════════════════════════════════
-- 019: Foodics delivery-driven flow + outbound status sync
-- ═══════════════════════════════════════════════════════════════════
-- الورك فلو الجديد (KebbaZone_Foodics_Integration_Flow):
--   webhook delivery_status=1 → 'preparing' مباشرة (بلا خطوة استلام)
--   زر "جاهز"     → 'ready'     + PUT /orders/{id} {delivery_status:2}
--   زر "تم التسليم" → 'completed' + PUT /orders/{id} {delivery_status:5, driver_collected_at}
--   status فوديكس 3 (declined) / 7 (void) → 'cancelled' (إزالة من العرض)
--
-- كل التغييرات إضافية وآمنة. حالة 'new' وخطوة الاستلام (rpc_kitchen_accept_order)
-- تبقى موجودة في القاعدة لكنها "موقوفة" في الواجهة — قابلة للإرجاع وقت الحاجة.

-- 1) توسيع قيد status ليشمل 'cancelled' (مع إبقاء 'new')
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'preparing', 'ready', 'completed', 'cancelled'));

-- 2) أعمدة الورك فلو الجديد
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source            INTEGER;     -- 1=POS/Cashier, 2=API, 3=Call Center
ALTER TABLE orders ADD COLUMN IF NOT EXISTS foodics_delivery_status INTEGER;     -- آخر delivery_status معروف (1,2,5,6)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at            TIMESTAMPTZ; -- لحظة "تم التسليم"
ALTER TABLE orders ADD COLUMN IF NOT EXISTS synced_to_foodics       BOOLEAN DEFAULT false; -- هل آخر تحديث وصل فوديكس؟

-- 3) توسيع scan_logs.scan_type ليشمل 'delivered'
ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_scan_type_check;
ALTER TABLE scan_logs ADD CONSTRAINT scan_logs_scan_type_check
  CHECK (scan_type IN ('first_scan', 'second_scan', 'accept', 'ready_scan', 'delivered'));

-- 4) الافتراضي للإنتاج: base URL فوديكس الإنتاجي (توكن production)
ALTER TABLE foodics_config ALTER COLUMN api_base_url SET DEFAULT 'https://api.foodics.com/v5';

-- ═══════════════════════════════════════════════════════════════════
-- RPCs للمزامنة العكسية — تُستدعى من Edge Function بعد نداء فوديكس (PUT)
-- الـ Edge Function تنفّذ الـ PUT ثم تمرّر نتيجته في p_synced.
-- forward-only محمي عبر شرط status في WHERE (لا تراجع للحالة).
-- ═══════════════════════════════════════════════════════════════════

-- زر "جاهز": preparing → ready (+ ختم delivery_status=2)
CREATE OR REPLACE FUNCTION rpc_kitchen_mark_ready_synced(
  p_session_id        UUID,
  p_order_internal_id UUID,
  p_device_info       TEXT,
  p_synced            BOOLEAN DEFAULT false
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
      synced_to_foodics       = p_synced
  WHERE id = p_order_internal_id AND status = 'preparing';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الطلب غير متاح للتحويل لجاهز');
  END IF;

  INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
  VALUES (p_order_internal_id, 'ready_scan', v_user.user_id::TEXT, p_device_info);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- زر "تم التسليم": ready → completed (+ ختم delivery_status=5 + delivered_at)
CREATE OR REPLACE FUNCTION rpc_kitchen_mark_delivered(
  p_session_id        UUID,
  p_order_internal_id UUID,
  p_device_info       TEXT,
  p_synced            BOOLEAN DEFAULT false
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
      synced_to_foodics       = p_synced
  WHERE id = p_order_internal_id AND status = 'ready';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الطلب غير متاح للتسليم');
  END IF;

  INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
  VALUES (p_order_internal_id, 'delivered', v_user.user_id::TEXT, p_device_info);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
