-- ═══════════════════════════════════════════════════════════════════
-- 034: إضافة الفرع الحادي عشر — النزهه (B11) + ربطه بفوديكس
-- ═══════════════════════════════════════════════════════════════════
-- المصدر: payload الـ webhook الإنتاجي (2026-11-19) — order.branch:
--   id = a332cb4e-88af-4911-aa58-83eac864ff3c, name = "النزهه",
--   name_localized = "Alnozha", reference = "B11"
--   (مجمع ريمان، طريق الأمير مقرن، حي النزهه، الرياض)
-- كان يرسل طلبات وتُرفض بـ branch_not_found لعدم وجوده في branches/mapping.
-- نفس اتفاقية 022: branches.code = reference فوديكس. آمن للتكرار.

INSERT INTO branches (name_ar, name_en, code, location_label, is_active)
VALUES ('النزهه', 'Al-Nozha', 'B11', 'Al-Nozha', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO foodics_branch_mapping (foodics_branch_id, branch_id)
SELECT 'a332cb4e-88af-4911-aa58-83eac864ff3c', id FROM branches WHERE code = 'B11'
ON CONFLICT (foodics_branch_id) DO NOTHING;

-- إعدادات شاشة العرض الافتراضية (نفس قيم باقي الفروع: default الأعمدة)
INSERT INTO branch_settings (branch_id)
SELECT id FROM branches WHERE code = 'B11'
ON CONFLICT (branch_id) DO NOTHING;
