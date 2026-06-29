-- ═══════════════════════════════════════════════════
-- 022: Seed Foodics branch mapping — PRODUCTION (business KebbaZone)
-- ═══════════════════════════════════════════════════
-- مصدر المعرّفات: GET https://api.foodics.com/v5/branches بتوكن الإنتاج (2026-06-29).
-- الـ 10 فروع الإنتاجية، الـ reference في فوديكس يطابق branches.code عندنا (B01..B10)
-- والأسماء مطابقة — تأكيد يدوي 100%.
--
-- ملاحظة: الربط بالـ reference (= code) بدل كتابة UUID مقابل code بإيدنا → أأمن ويوثّق نفسه.
-- يُطبَّق على مشروع الإنتاج (ucpudjjahbctzluseipo). آمن للتكرار (ON CONFLICT DO NOTHING).
--
-- ⚠️ المعرّفات أدناه إنتاجية وتختلف عن معرّفات Sandbox في 018. لو الـ mapping القديم (018)
--    موجود في قاعدة بيانات الإنتاج بمعرّف Sandbox خاطئ على نفس الفرع، احذفه أولاً:
--    DELETE FROM foodics_branch_mapping
--    WHERE foodics_branch_id = 'a217671a-c2dd-482a-8b9c-eced99466fe1';  -- Sandbox B01 القديم

INSERT INTO foodics_branch_mapping (foodics_branch_id, branch_id)
SELECT '9bc1e882-4aea-4723-82ca-5490f33d1906', id FROM branches WHERE code = 'B01'  -- عرقه
UNION ALL SELECT '9bc1e882-4c1e-4910-abe0-3483ae6a67f5', id FROM branches WHERE code = 'B02'  -- لبن
UNION ALL SELECT '9bc1e882-4d1c-4db2-a8c6-70a475bf2cbb', id FROM branches WHERE code = 'B03'  -- اشبيليه
UNION ALL SELECT '9bc1e882-50b8-4f13-ae2d-71ad0c1fa5e1', id FROM branches WHERE code = 'B04'  -- الملقا
UNION ALL SELECT '9d9cff0d-85ad-4d96-bdf7-e6bc8be2edfd', id FROM branches WHERE code = 'B05'  -- الشفا
UNION ALL SELECT '9e4bde6d-e85d-40d3-a47f-fef8b6f74d44', id FROM branches WHERE code = 'B06'  -- الريان
UNION ALL SELECT '9e4d89f8-4e02-41b3-8e8c-0a41e8b88675', id FROM branches WHERE code = 'B07'  -- الربيع
UNION ALL SELECT '9fc63688-2eee-4bea-89f5-555a796243b5', id FROM branches WHERE code = 'B08'  -- النرجس
UNION ALL SELECT 'a0b25b80-9c20-4bf4-91ce-13d47ed8d46f', id FROM branches WHERE code = 'B09'  -- السويدي
UNION ALL SELECT 'a1181e46-997a-436a-8b47-59eb5ede9b27', id FROM branches WHERE code = 'B10'  -- الرمال
ON CONFLICT (foodics_branch_id) DO NOTHING;
