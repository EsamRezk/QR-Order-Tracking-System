-- ═══════════════════════════════════════════════════
-- 025: أداء التحميل — View خفيف لشاشتي الفرع والعرض
-- ═══════════════════════════════════════════════════
-- المشكلة: استعلام الطلبات كان select('*') يجرّ عمود raw_qr_data (JSONB) كاملاً
-- = payload فوديكس الخام بالكامل (items/products/customer/payments...) لكل طلب،
-- بمئات/آلاف الطلبات النشطة المتراكمة ⇒ ميجابايتات تُنقل وتُحلَّل في المتصفح ⇒ بطء.
--
-- الحل: view يُرجع نفس أعمدة orders لكن مع raw_qr_data "مُقلّم" — يحتوي فقط
-- الحقول التي تقرأها الواجهة (كشف التطبيق + رقم العرض) من foodics_order،
-- ويحذف المصفوفات الضخمة. شكل البيانات يبقى مطابقاً فلا يتغيّر كود الواجهة.
-- (الـ Realtime يبقى على جدول orders نفسه — صفوف مفردة، لا مشكلة حجم.)

CREATE OR REPLACE VIEW v_orders_display AS
SELECT
  o.id,
  o.order_id,
  o.branch_id,
  o.channel_link,
  o.status,
  o.scanned_at,
  o.ready_at,
  o.completed_at,
  o.delivered_at,
  o.created_at,
  o.prep_duration_seconds,
  o.source,
  o.foodics_order_id,
  o.foodics_order_number,
  o.order_type,
  o.order_source,
  o.foodics_delivery_status,
  o.synced_to_foodics,
  -- raw_qr_data مُقلّم: فقط الحقول التي يقرأها deliveryApps.js فعلاً (كشف التطبيق + الأرقام).
  -- meta و delivery نُقلّمهما لحقولهما المستخدمة فقط (meta فيه receipt_qr/products_kitchen = bloat).
  -- لو لا يوجد foodics_order نُبقي raw_qr_data كما هو (طلبات QR القديمة صغيرة أصلاً).
  CASE
    WHEN o.raw_qr_data ? 'foodics_order' THEN
      jsonb_build_object(
        'foodics_order', jsonb_strip_nulls(jsonb_build_object(
          -- كشف التطبيق (resolveDeliveryApp)
          'app_id',           o.raw_qr_data->'foodics_order'->'app_id',
          'meta',             jsonb_strip_nulls(jsonb_build_object(
                                'channelLink',     o.raw_qr_data->'foodics_order'->'meta'->'channelLink',
                                'external_number', o.raw_qr_data->'foodics_order'->'meta'->'external_number'
                              )),
          'aggregator',       o.raw_qr_data->'foodics_order'->'aggregator',       -- {name, reference}
          'delivery',         jsonb_build_object('aggregator', jsonb_build_object(
                                'name', o.raw_qr_data->'foodics_order'->'delivery'->'aggregator'->>'name'
                              )),
          'delivery_company', o.raw_qr_data->'foodics_order'->'delivery_company', -- {name}
          'customer',         jsonb_build_object('name', o.raw_qr_data->'foodics_order'->'customer'->>'name'),
          'tags',             o.raw_qr_data->'foodics_order'->'tags',             -- [{name}]
          -- الأرقام (resolveDisplayNumber/resolveFoodicsNumber)
          'reference',        o.raw_qr_data->'foodics_order'->'reference',
          'reference_x',      o.raw_qr_data->'foodics_order'->'reference_x'
        ))
      )
    ELSE o.raw_qr_data
  END AS raw_qr_data
FROM orders o;

-- إتاحة الـ view لـ PostgREST (نفس صلاحيات orders المفتوحة في MVP)
GRANT SELECT ON v_orders_display TO anon, authenticated;

-- فهارس تسرّع فلترة الطلبات الشائعة (النشطة + المكتملة الأحدث)
CREATE INDEX IF NOT EXISTS idx_orders_branch_status_created
  ON orders (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_branch_completed_at
  ON orders (branch_id, completed_at DESC)
  WHERE status = 'completed';
