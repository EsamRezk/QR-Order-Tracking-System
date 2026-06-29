-- ═══════════════════════════════════════════════════
-- 023: Branch display settings — مفتاح "إظهار كل الطلبات على شاشة العرض"
-- ═══════════════════════════════════════════════════
-- جدول إعداد لكل فرع. show_all_on_display:
--   false (افتراضي) → شاشة العرض تُظهر طلبات تطبيقات التوصيل فقط (تخفي غير-التوصيل).
--   true            → شاشة العرض تُظهر كل الطلبات في تسلسلها الطبيعي.
-- يُضبط من "شاشة الفرع" (المطبخ سابقاً) ويُقرأ realtime من شاشة العرض على أي جهاز آخر.
-- شاشة الفرع/المطبخ نفسها تعرض كل الطلبات دائماً — هذا الإعداد يخص شاشة العرض فقط.
-- RLS مفتوح (MVP) مثل جدول orders.

CREATE TABLE IF NOT EXISTS branch_settings (
  branch_id            UUID PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  show_all_on_display  BOOLEAN NOT NULL DEFAULT false,
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE branch_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON branch_settings FOR ALL USING (true) WITH CHECK (true);

-- صف افتراضي (unchecked) لكل فرع موجود حالياً
INSERT INTO branch_settings (branch_id)
SELECT id FROM branches
ON CONFLICT (branch_id) DO NOTHING;

-- realtime لمزامنة الحالة لحظياً بين الأجهزة
ALTER PUBLICATION supabase_realtime ADD TABLE branch_settings;
