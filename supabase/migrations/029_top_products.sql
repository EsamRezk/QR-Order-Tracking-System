-- ═══════════════════════════════════════════════════════════════════
-- 029: تحليلات المنتجات الأكثر مبيعاً — جدول order_items + RPC تجميع
-- ═══════════════════════════════════════════════════════════════════
-- المطلوب: سكشن في صفحة التحليلات يعرض (١) أعلى 10 منتجات مبيعاً على كل
-- الفروع مجمّعة، و(٢) أعلى منتج في كل فرع — بالكمية (وقيمة المبيعات كمقياس
-- ثانٍ)، بناءً على طلبات فوديكس (تطبيقات التوصيل + POS).
--
-- ⚠️ لماذا جدول منفصل وليس unnest مباشرة على raw_qr_data؟
--   بيانات المنتجات تعيش داخل raw_qr_data.foodics_order.products (JSONB ضخم).
--   عمل unnest حيّ على آلاف الطلبات في كل فتح للصفحة = detoast كيلوبايتات/صف
--   = بالضبط انهيار statement_timeout (57014) الذي عالجناه في migration 027.
--   الحل المتّسق مع تصميم 027: نستخرج بنود الطلب مرة واحدة عند الكتابة (trigger)
--   إلى جدول مسطّح مفهرس order_items، والتحليلات تُجمّع منه بلا لمس JSON إطلاقاً.
--
-- تعريفات متّفق عليها:
--   • المنتجات الأساسية فقط (products[]) — نتجاهل الإضافات options[] والكومبو combos[].
--   • الكمية المُباعة = quantity - returned_quantity.
--   • قيمة المبيعات = total_price (شامل الضريبة، كما يدفعه العميل).
--   • نستبعد الطلبات الملغاة (status = 'cancelled') — بالربط الحيّ مع orders.status.
--   • مفتاح التجميع = product.id (ثابت عند تغيّر الاسم)، والاسم المعروض = product.name.

-- ── (أ) جدول بنود الطلب ───────────────────────────────────────────────
-- branch_id و created_at منسوخان هنا ليتم فلترة التاريخ/الفرع بلا join مع orders
-- (وبلا لمس raw_qr_data). الربط مع orders يقتصر على قراءة status الصغير لاستبعاد الملغى.
CREATE TABLE IF NOT EXISTS order_items (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  branch_id         uuid,
  created_at        timestamptz NOT NULL,
  product_id        text,
  product_name      text,
  product_name_en   text,
  category_name     text,
  quantity          numeric NOT NULL DEFAULT 0,
  returned_quantity numeric NOT NULL DEFAULT 0,
  unit_price        numeric NOT NULL DEFAULT 0,
  total_price       numeric NOT NULL DEFAULT 0
);

-- فلترة "كل الفروع" بمدى تاريخ، وفلترة فرع محدد بمدى تاريخ، وحذف/مزامنة بند الطلب.
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON order_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_branch_created ON order_items (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

-- RLS: قراءة مفتوحة (كباقي جداول التحليلات في المشروع)، والكتابة عبر الـ trigger (service role).
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_items_read ON order_items;
CREATE POLICY order_items_read ON order_items FOR SELECT USING (true);

-- ── (ب) استخراج بنود الطلب من raw_qr_data ────────────────────────────
-- يفكّ مصفوفة products[] إلى صفوف مسطّحة. الإضافات options[] والكومبو combos[]
-- خارج النطاق عمداً (منتجات أساسية فقط).
CREATE OR REPLACE FUNCTION kz_sync_order_items(
  p_order_id uuid, p_branch_id uuid, p_created_at timestamptz, p_raw jsonb
) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO order_items (
    order_id, branch_id, created_at, product_id, product_name,
    product_name_en, category_name, quantity, returned_quantity, unit_price, total_price
  )
  SELECT
    p_order_id, p_branch_id, p_created_at,
    NULLIF(p->'product'->>'id', ''),
    NULLIF(p->'product'->>'name', ''),
    NULLIF(p->'product'->>'name_localized', ''),
    NULLIF(p->'product'->'category'->>'name', ''),
    COALESCE((p->>'quantity')::numeric, 0),
    COALESCE((p->>'returned_quantity')::numeric, 0),
    COALESCE((p->>'unit_price')::numeric, 0),
    COALESCE((p->>'total_price')::numeric, 0)
  FROM jsonb_array_elements(p_raw->'foodics_order'->'products') AS p
  WHERE jsonb_typeof(p_raw->'foodics_order'->'products') = 'array';
$$;

-- trigger: يعيد بناء بنود الطلب عند إدراجه أو عند تحديث raw_qr_data (idempotent: حذف ثم إدراج).
CREATE OR REPLACE FUNCTION trg_orders_sync_items()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM order_items WHERE order_id = NEW.id;
  PERFORM kz_sync_order_items(NEW.id, NEW.branch_id, NEW.created_at, NEW.raw_qr_data);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_sync_items ON orders;
CREATE TRIGGER orders_sync_items
  AFTER INSERT OR UPDATE OF raw_qr_data ON orders
  FOR EACH ROW EXECUTE FUNCTION trg_orders_sync_items();

-- ── (ج) backfill للطلبات الموجودة (يقرأ raw_qr_data مرة واحدة) ────────
TRUNCATE order_items;
INSERT INTO order_items (
  order_id, branch_id, created_at, product_id, product_name,
  product_name_en, category_name, quantity, returned_quantity, unit_price, total_price
)
SELECT
  o.id, o.branch_id, o.created_at,
  NULLIF(p->'product'->>'id', ''),
  NULLIF(p->'product'->>'name', ''),
  NULLIF(p->'product'->>'name_localized', ''),
  NULLIF(p->'product'->'category'->>'name', ''),
  COALESCE((p->>'quantity')::numeric, 0),
  COALESCE((p->>'returned_quantity')::numeric, 0),
  COALESCE((p->>'unit_price')::numeric, 0),
  COALESCE((p->>'total_price')::numeric, 0)
FROM orders o
CROSS JOIN LATERAL jsonb_array_elements(o.raw_qr_data->'foodics_order'->'products') AS p
WHERE jsonb_typeof(o.raw_qr_data->'foodics_order'->'products') = 'array';

-- ── (د) RPC التجميع — أعلى المنتجات إجمالاً + أعلى منتج لكل فرع ───────
-- ترجع: { overall:[{name,qty,revenue}], by_branch:[{branch,name,qty,revenue}] }
-- overall مرتّبة تنازلياً بالكمية (أعلى p_limit)، by_branch صف لكل فرع نشط بمنتجه الأول.
CREATE OR REPLACE FUNCTION rpc_top_products(
  p_from timestamptz, p_branch_id uuid DEFAULT NULL, p_limit int DEFAULT 10
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH items AS (
  SELECT oi.product_id, oi.product_name, oi.branch_id,
         (oi.quantity - oi.returned_quantity) AS qty,
         oi.total_price AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.created_at >= p_from
    AND o.status <> 'cancelled'
    AND (p_branch_id IS NULL OR oi.branch_id = p_branch_id)
),
overall AS (
  SELECT COALESCE(product_name, '؟') AS name,
         SUM(qty) AS qty, SUM(revenue) AS revenue
  FROM items
  GROUP BY COALESCE(product_id, product_name), COALESCE(product_name, '؟')
  ORDER BY SUM(qty) DESC
  LIMIT p_limit
),
per_branch AS (
  SELECT b.name_ar AS branch, t.name, t.qty, t.revenue
  FROM branches b
  LEFT JOIN LATERAL (
    SELECT i.product_name AS name, SUM(i.qty) AS qty, SUM(i.revenue) AS revenue
    FROM items i
    WHERE i.branch_id = b.id
    GROUP BY COALESCE(i.product_id, i.product_name), i.product_name
    ORDER BY SUM(i.qty) DESC
    LIMIT 1
  ) t ON true
  WHERE b.is_active AND (p_branch_id IS NULL OR b.id = p_branch_id)
)
SELECT jsonb_build_object(
  'overall', (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue) ORDER BY qty DESC
    ), '[]'::jsonb) FROM overall
  ),
  'by_branch', (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('branch', branch, 'name', name, 'qty', qty, 'revenue', revenue)
      ORDER BY qty DESC NULLS LAST
    ), '[]'::jsonb) FROM per_branch
  )
);
$$;

GRANT EXECUTE ON FUNCTION rpc_top_products(timestamptz, uuid, int) TO anon, authenticated;

-- إعادة تحميل schema cache في PostgREST (الجدول والدالة الجديدة)
NOTIFY pgrst, 'reload schema';
