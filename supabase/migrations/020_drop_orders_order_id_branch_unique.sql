-- ═══════════════════════════════════════════════════════════════════
-- 019: حذف قيد التفرّد القديم (order_id, branch_id)
-- ═══════════════════════════════════════════════════════════════════
-- القيد UNIQUE(order_id, branch_id) كان من نظام QR (المُلغى نهائياً 2026-06-22).
-- مصدر الطلبات الوحيد الآن هو Foodics، و Foodics يعيد ترقيم الطلبات (order.number)
-- لكل يوم/فرع — فيتكرر الرقم 1،2،3... عبر الأيام ويصطدم بهذا القيد، فيفشل INSERT
-- بخطأ 23505 رغم أن الطلب جديد فعلاً.
--
-- التفرّد الحقيقي للطلب مضمون أصلاً عبر:
--   idx_orders_foodics_order_id  =  UNIQUE(foodics_order_id)  (migration 014)
-- لذا حذف هذا القيد آمن، ويسمح بتكرار رقم العرض عبر الأيام (سلوك مطلوب).
--
-- ⚠️ طبّق هذا على مشروعَي Supabase معاً: التيست (mbmrcvazjdzkarysqwgb) والبرود (ucpudjjahbctzluseipo).

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_id_branch_id_key;
