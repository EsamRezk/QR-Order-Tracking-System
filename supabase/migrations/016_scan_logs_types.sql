-- ═══════════════════════════════════════════════════
-- 016: Extend scan_logs.scan_type for the new flow
-- ═══════════════════════════════════════════════════
-- 'accept'     → الموظف استلم الطلب (new → preparing)
-- 'ready_scan' → تحويل لجاهز عبر المسح (اختياري مستقبلاً)
-- نبقي على 'first_scan'/'second_scan' لتوافق التدفق الحالي.

ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_scan_type_check;
ALTER TABLE scan_logs ADD CONSTRAINT scan_logs_scan_type_check
  CHECK (scan_type IN ('first_scan', 'second_scan', 'accept', 'ready_scan'));
