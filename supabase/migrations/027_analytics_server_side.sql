-- ═══════════════════════════════════════════════════════════════════
-- 027: صفحة التحليلات — نقل الحساب والفلترة إلى قاعدة البيانات
-- ═══════════════════════════════════════════════════════════════════
-- المشكلة (برودكشن): Analytics كانت تجلب *كل* طلبات الفترة إلى المتصفح
-- (fetchAllPaged على دفعات 1000) لحساب الإحصائيات والفلترة محلياً. مع +6000
-- طلب بالأسبوع (وتتزايد آلافاً يومياً):
--   1) لا يوجد فهرس على created_at وحده، فكل صفحة offset تعيد فحص/فرز
--      الجدول كاملاً من جديد (الفهرس المركّب branch_id,status,created_at
--      لا يخدم استعلام "جميع الفروع" بمدى تاريخ فقط).
--   2) استخراج ~11 مسار JSON من raw_qr_data الضخم (detoast كيلوبايتات/صف)
--      لآلاف الصفوف في كل استعلام.
--   ⇒ تجاوز statement_timeout (57014) ⇒ 500 ⇒ fetchAllPaged يبتلع الخطأ
--   ⇒ الصفحة تعرض أصفاراً.
--
-- الحل (تصميم): يُحسب عند الكتابة لا عند القراءة، ويُجمَّع في القاعدة لا في المتصفح:
--   أ) أعمدة محسوبة على orders عبر trigger: delivery_app / app_number /
--      foodics_ref — تُحسب مرة واحدة عند INSERT/UPDATE بدل استخراج JSON
--      لكل صف في كل استعلام، وتتيح فلترة SQL مباشرة (بالتطبيق/بالرقم).
--      ⚠️ المنطق مطابق لـ src/config/deliveryApps.js (resolveDeliveryApp/
--      resolveAppOrderNumber/resolveFoodicsNumber) — عند تعديل الأسماء هناك
--      حدِّث الدالة هنا وأعد الـ backfill.
--   ب) فهارس على created_at (وحده + مع branch_id) وعلى scan_logs.
--   ج) RPC تجميع واحدة rpc_analytics_summary ترجع KPIs + متوسط الفروع +
--      التوزيع الساعي في رحلة واحدة — أعمدة صغيرة فقط، بلا JSONB إطلاقاً.
--   والواجهة تجلب صفحة الجدول الظاهرة فقط (50 صف) بفلاتر SQL.

-- ── (أ) الأعمدة المحسوبة ──────────────────────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_app TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS app_number   TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS foodics_ref  TEXT;

-- يحدد هوية تطبيق التوصيل — نسخة SQL مطابقة لـ resolveDeliveryApp في
-- deliveryApps.js: نفس الحقول المرشّحة، نفس الأسماء (ALIASES)، نفس الترتيب.
CREATE OR REPLACE FUNCTION kz_resolve_delivery_app(p_raw jsonb, p_channel_link text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  fo jsonb := COALESCE(p_raw->'foodics_order', '{}'::jsonb);
  -- app_id الكاشير اليدوي: لا نطابق اسم العميل لطلباته (كما في JS)
  is_cashier boolean := (fo->>'app_id') = '8f9eb3f6-7987-4f66-aa8c-478c34d0c568';
  hay text;
BEGIN
  hay := lower(concat_ws(' ',
    fo->'meta'->>'channelLink',
    fo->'meta'->>'external_number',
    fo->'aggregator'->>'name',
    fo->'aggregator'->>'reference',
    fo->'delivery'->'aggregator'->>'name',
    fo->'delivery_company'->>'name',
    CASE WHEN is_cashier THEN NULL ELSE fo->'customer'->>'name' END,
    fo->>'reference',
    fo->>'reference_x',
    CASE WHEN jsonb_typeof(fo->'tags') = 'array'
         THEN (SELECT string_agg(t->>'name', ' ') FROM jsonb_array_elements(fo->'tags') t)
    END,
    p_channel_link
  ));
  IF hay ~ '(keeta|كيتا|meituan)'                                          THEN RETURN 'keeta'; END IF;
  IF hay ~ '(hungerstation|hunger station|hunger|هنقرستيشن|هنجرستيشن)'      THEN RETURN 'hungerstation'; END IF;
  IF hay ~ '(jahez|جاهز)'                                                  THEN RETURN 'jahez'; END IF;
  IF hay ~ '(chefz|the chefz|thechefz|ذا شيفز|شيفز)'                        THEN RETURN 'chefz'; END IF;
  IF hay ~ '(ninja|نينجا)'                                                 THEN RETURN 'ninja'; END IF;
  IF hay ~ '(mrsool|marsool|مرسول)'                                        THEN RETURN 'mrsool'; END IF;
  IF hay ~ '(toyou|to you|to-you|تويو)'                                    THEN RETURN 'toyou'; END IF;
  RETURN 'direct';
END $$;

-- رقم الطلب داخل تطبيق التوصيل — نسخة SQL من resolveAppOrderNumber:
-- ما بعد أول ":" في meta.external_number، أول سطر فقط، بلا فراغات.
CREATE OR REPLACE FUNCTION kz_extract_app_number(p_raw jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(btrim(split_part(btrim(substring(ext FROM position(':' IN ext) + 1)), E'\n', 1)), '')
  FROM (SELECT p_raw->'foodics_order'->'meta'->>'external_number' AS ext) s
  WHERE ext LIKE '%:%'
$$;

CREATE OR REPLACE FUNCTION trg_orders_analytics_fields()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.delivery_app := kz_resolve_delivery_app(NEW.raw_qr_data, NEW.channel_link);
  NEW.app_number   := kz_extract_app_number(NEW.raw_qr_data);
  NEW.foodics_ref  := NULLIF(NEW.raw_qr_data->'foodics_order'->>'reference', '');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_analytics_fields ON orders;
CREATE TRIGGER orders_analytics_fields
  BEFORE INSERT OR UPDATE OF raw_qr_data, channel_link ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_orders_analytics_fields();

-- backfill الصفوف الموجودة (يُعاد تشغيله عند تحديث أسماء التطبيقات)
UPDATE orders SET
  delivery_app = kz_resolve_delivery_app(raw_qr_data, channel_link),
  app_number   = kz_extract_app_number(raw_qr_data),
  foodics_ref  = NULLIF(raw_qr_data->'foodics_order'->>'reference', '');

-- ── (ب) الفهارس ──────────────────────────────────────────────────────

-- استعلام "جميع الفروع" بمدى تاريخ + ترتيب تنازلي (الفهرس المركّب القديم لا يخدمه)
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (created_at DESC);

-- فرع محدد + مدى تاريخ (بلا شرط status، بعكس idx_orders_branch_status_created)
CREATE INDEX IF NOT EXISTS idx_orders_branch_created
  ON orders (branch_id, created_at DESC);

-- مصدر تغيير الحالة: جلب سجلات صفوف الصفحة الظاهرة بالـ id
CREATE INDEX IF NOT EXISTS idx_scan_logs_order_id
  ON scan_logs (order_id);

-- جلب سجلات الفترة عند التصدير (مدى تاريخ)
CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at
  ON scan_logs (scanned_at DESC);

-- ── (ج) RPC التجميع — رحلة واحدة لكل إحصائيات الصفحة ─────────────────
-- ترجع: {total, avg, fastest, slowest, by_branch:[{name,avg}], hourly:[{hour,count}]}
-- المتوسط/الأسرع/الأبطأ على prep_duration_seconds > 0 فقط (كما في الواجهة سابقاً)،
-- ومتوسط الفرع بالدقائق بكسر واحد، والتوزيع الساعي بتوقيت الرياض.
CREATE OR REPLACE FUNCTION rpc_analytics_summary(p_from timestamptz, p_branch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH rows AS (
  SELECT branch_id, created_at, prep_duration_seconds
  FROM orders
  WHERE created_at >= p_from
    AND (p_branch_id IS NULL OR branch_id = p_branch_id)
),
kpi AS (
  SELECT count(*)                                                          AS total,
         round(avg(prep_duration_seconds) FILTER (WHERE prep_duration_seconds > 0))::int AS avg,
         min(prep_duration_seconds) FILTER (WHERE prep_duration_seconds > 0)             AS fastest,
         max(prep_duration_seconds) FILTER (WHERE prep_duration_seconds > 0)             AS slowest
  FROM rows
),
by_branch AS (
  -- بلا فرع محدد: كل الفروع النشطة تظهر حتى بلا طلبات مكتملة (متوسط 0) — كسلوك الواجهة
  SELECT b.name_ar AS name,
         COALESCE(round(avg(r.prep_duration_seconds) FILTER (WHERE r.prep_duration_seconds > 0) / 60.0, 1), 0) AS avg
  FROM branches b
  LEFT JOIN rows r ON r.branch_id = b.id
  WHERE b.is_active AND (p_branch_id IS NULL OR b.id = p_branch_id)
  GROUP BY b.id, b.name_ar
),
hourly AS (
  SELECT h.h AS hour, COALESCE(c.cnt, 0) AS count
  FROM generate_series(0, 23) AS h(h)
  LEFT JOIN (
    SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Riyadh')::int AS hh, count(*) AS cnt
    FROM rows GROUP BY 1
  ) c ON c.hh = h.h
)
SELECT jsonb_build_object(
  'total',     (SELECT total FROM kpi),
  'avg',       COALESCE((SELECT avg FROM kpi), 0),
  'fastest',   COALESCE((SELECT fastest FROM kpi), 0),
  'slowest',   COALESCE((SELECT slowest FROM kpi), 0),
  'by_branch', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'avg', avg) ORDER BY name), '[]'::jsonb) FROM by_branch),
  'hourly',    (SELECT jsonb_agg(jsonb_build_object('hour', hour, 'count', count) ORDER BY hour) FROM hourly)
);
$$;

GRANT EXECUTE ON FUNCTION rpc_analytics_summary(timestamptz, uuid) TO anon, authenticated;

-- إعادة تحميل schema cache في PostgREST (الأعمدة والدالة الجديدة)
NOTIFY pgrst, 'reload schema';
