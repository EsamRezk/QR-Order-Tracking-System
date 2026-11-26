-- ═══════════════════════════════════════════════════════════════════
-- 036: إقفال تلقائي لأي طلب فاتت عليه ساعتين (2026-11-26)
-- ═══════════════════════════════════════════════════════════════════
-- المشكلة: الفروع بتقفل الطلبات من كاشير فوديكس، والطلبات اللي اتقفلت قبل
-- "جاهز" (طباعة فاتورة) بتفضل مفتوحة عندنا بالقصد — فبتتكوّم على شاشة الفرع
-- (~3700 طلب مفتوح فات عليه أكتر من ساعتين في كل الفروع وقت الترحيلة).
--
-- الحل: مهمة pg_cron كل 5 دقائق تقفل أي طلب (new / preparing / ready) فات على
-- إنشائه ساعتين:
--   - status = completed + completed_at = now()
--   - synced_to_foodics = true → ما فيش أي إرسال لفوديكس (الطلب عندهم متقفل غالباً)
--   - صف في scan_logs بنوع 'auto_closed' (scanned_by = 'system') علشان نقدر نعدّ
--     كام طلب اتقفل تلقائي في كل فرع
-- Realtime يشيل الكروت من الشاشات لوحده.
-- أي حدث لاحق من فوديكس على طلب مقفول = no-op (forward-only في الـ webhook).

-- ١) نوع جديد في سجل الحركات
ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_scan_type_check;
ALTER TABLE scan_logs ADD CONSTRAINT scan_logs_scan_type_check
  CHECK (scan_type IN ('first_scan', 'second_scan', 'accept', 'ready_scan', 'delivered', 'auto_closed'));

-- ٢) دالة الإقفال — ترجع عدد الطلبات اللي اتقفلت
CREATE OR REPLACE FUNCTION fn_auto_close_stale_orders(p_max_age interval DEFAULT interval '2 hours')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH closed AS (
    UPDATE orders
    SET status = 'completed',
        completed_at = now(),
        synced_to_foodics = true
    WHERE status IN ('new', 'preparing', 'ready')
      AND created_at < now() - p_max_age
    RETURNING id
  ), logged AS (
    INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
    SELECT id, 'auto_closed', 'system', 'auto-close after ' || p_max_age::text
    FROM closed
    RETURNING 1
  )
  SELECT count(*) INTO n FROM logged;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_auto_close_stale_orders(interval) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION fn_auto_close_stale_orders(interval) TO service_role;

-- ٣) الجدولة: كل 5 دقائق
SELECT cron.schedule(
  'auto-close-stale-orders',
  '*/5 * * * *',
  $$SELECT fn_auto_close_stale_orders()$$
);
