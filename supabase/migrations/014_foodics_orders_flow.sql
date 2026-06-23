-- ═══════════════════════════════════════════════════
-- 014: Foodics order flow — add 'new' status + Foodics columns + accept tracking
-- ═══════════════════════════════════════════════════
-- التدفق الجديد: Foodics webhook → 'new' → (استلام) → 'preparing' → 'ready' → 'completed'
-- آمن: كل التغييرات إضافية ولا تكسر تدفق QR الحالي.

-- 1) إضافة حالة 'new' لقيد CHECK على orders.status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'preparing', 'ready', 'completed'));

-- 2) أعمدة Foodics + تتبع الاستلام
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source               TEXT DEFAULT 'qr';  -- 'foodics' | 'qr'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS foodics_order_id     TEXT;               -- UUID من Foodics
ALTER TABLE orders ADD COLUMN IF NOT EXISTS foodics_order_number TEXT;               -- الرقم المعروض
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type           TEXT;               -- dine_in | pickup | delivery
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at          TIMESTAMPTZ;        -- لحظة "استلام" الطلب
ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_by          TEXT;               -- user_id الذي استلم

-- 3) منع تكرار طلب Foodics (فهرس فريد جزئي)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_foodics_order_id
  ON orders(foodics_order_id) WHERE foodics_order_id IS NOT NULL;

-- ملاحظة عن مدة التحضير:
-- prep_duration_seconds عمود GENERATED = ready_at - scanned_at.
-- في طلبات Foodics يدخل الطلب كـ 'new' و scanned_at = now() افتراضياً،
-- لذلك عند الاستلام (rpc_kitchen_accept_order) نعيد ضبط scanned_at = now()
-- ليبقى الرقم = مدة التجهيز الفعلية (من الاستلام حتى الجاهزية).
