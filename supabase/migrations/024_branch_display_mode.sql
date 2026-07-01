-- ═══════════════════════════════════════════════════
-- 024: Display mode — وضع عرض الطلبات على شاشة العرض
-- ═══════════════════════════════════════════════════
-- عمود إضافي على branch_settings يُضبط من صفحة "إعدادات شاشة العرض"
-- ويُطبَّق realtime على "شاشة العرض":
--   'all'       (افتراضي) → عرض كل الطلبات (قيد التجهيز + جاهز + تم التسليم).
--   'ready'               → عرض الجاهز فقط.
--   'preparing'           → عرض قيد التجهيز (النشط) فقط.
--   'split'               → عمودان: يمين "جاهز" + يسار "قيد التجهيز" (7 لكل صف).
-- مستقلّ عن show_all_on_display (الذي يفلتر التوصيل مقابل غير-التوصيل).

ALTER TABLE branch_settings
  ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'all'
  CHECK (display_mode IN ('all', 'ready', 'preparing', 'split'));
