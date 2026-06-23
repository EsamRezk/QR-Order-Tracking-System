-- ═══════════════════════════════════════════════════
-- 018: Seed Foodics branch mapping
-- ═══════════════════════════════════════════════════
-- بيئة Sandbox (حساب 922240): يوجد فرع واحد فقط:
--   Foodics "Branch 1"  id=a217671a-c2dd-482a-8b9c-eced99466fe1  reference=B01
-- نربطه بفرعنا B01 (عرقه/Irqa).
--
-- ⚠️ Production: عند الانتقال للإنتاج، استبدل الـ id بمعرّفات فروع Foodics الحقيقية
-- (اجلبها عبر scripts/foodics-list-branches.mjs) وأضف صفاً لكل فرع.

INSERT INTO foodics_branch_mapping (foodics_branch_id, branch_id)
SELECT 'a217671a-c2dd-482a-8b9c-eced99466fe1', id FROM branches WHERE code = 'B01'
ON CONFLICT (foodics_branch_id) DO NOTHING;
