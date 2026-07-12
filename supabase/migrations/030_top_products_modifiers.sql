-- ═══════════════════════════════════════════════════════════════════
-- 030: تفصيل مكوّنات المنتج (الإضافات/النكهات) في تحليلات الأكثر مبيعاً
-- ═══════════════════════════════════════════════════════════════════
-- المشكلة: أسماء المنتجات وحدها غامضة — "بوكس مشكل 3" لا يوضّح المحتوى
-- (كبة لحم؟ دجاج؟ جبنة؟). التفاصيل موجودة داخل products[].options[] لكن
-- migration 029 كان يتجاهلها (منتجات أساسية فقط).
--
-- القرار (بطلب صاحب المشروع): "البوكس بتركيبته الكاملة" — نميّز كل تركيبة
-- مكوّنات كصف مستقل. نخزّن نصّ الإضافات المرتّب (modifiers) بجوار المنتج،
-- ونجمّع في التحليلات على (product_id + modifiers) بدل product_id وحده.
--   • modifiers = أسماء options[].modifier_option مرتّبة، مفصولة بـ "، "،
--     ومع اللاحقة "×N" لو الكمية > 1.
--   • الاسم المعروض = product_name (الأساسي)، والمكوّنات في حقل modifiers منفصل
--     (تعرضهما الواجهة كسطرين: المنتج + تفصيل تحته).

-- ── (أ) عمود المكوّنات ────────────────────────────────────────────────
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS modifiers text;

-- ── (ب) تحديث دالة الاستخراج لتحسب modifiers ─────────────────────────
CREATE OR REPLACE FUNCTION kz_sync_order_items(
  p_order_id uuid, p_branch_id uuid, p_created_at timestamptz, p_raw jsonb
) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO order_items (
    order_id, branch_id, created_at, product_id, product_name,
    product_name_en, category_name, modifiers, quantity, returned_quantity, unit_price, total_price
  )
  SELECT
    p_order_id, p_branch_id, p_created_at,
    NULLIF(p->'product'->>'id', ''),
    NULLIF(p->'product'->>'name', ''),
    NULLIF(p->'product'->>'name_localized', ''),
    NULLIF(p->'product'->'category'->>'name', ''),
    (
      SELECT string_agg(
        m.nm || CASE WHEN m.qty > 1 THEN ' ×' || m.qty::text ELSE '' END,
        '، ' ORDER BY m.nm
      )
      FROM (
        SELECT NULLIF(opt->'modifier_option'->>'name', '') AS nm,
               COALESCE((opt->>'quantity')::numeric, 1)     AS qty
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(p->'options') = 'array' THEN p->'options' ELSE '[]'::jsonb END
        ) AS opt
      ) m
      WHERE m.nm IS NOT NULL
    ),
    COALESCE((p->>'quantity')::numeric, 0),
    COALESCE((p->>'returned_quantity')::numeric, 0),
    COALESCE((p->>'unit_price')::numeric, 0),
    COALESCE((p->>'total_price')::numeric, 0)
  FROM jsonb_array_elements(p_raw->'foodics_order'->'products') AS p
  WHERE jsonb_typeof(p_raw->'foodics_order'->'products') = 'array';
$$;

-- ── (ج) إعادة backfill بالمكوّنات (الـ trigger لم يتغيّر — يستدعي الدالة أعلاه) ──
TRUNCATE order_items;
INSERT INTO order_items (
  order_id, branch_id, created_at, product_id, product_name,
  product_name_en, category_name, modifiers, quantity, returned_quantity, unit_price, total_price
)
SELECT
  o.id, o.branch_id, o.created_at,
  NULLIF(p->'product'->>'id', ''),
  NULLIF(p->'product'->>'name', ''),
  NULLIF(p->'product'->>'name_localized', ''),
  NULLIF(p->'product'->'category'->>'name', ''),
  (
    SELECT string_agg(
      m.nm || CASE WHEN m.qty > 1 THEN ' ×' || m.qty::text ELSE '' END,
      '، ' ORDER BY m.nm
    )
    FROM (
      SELECT NULLIF(opt->'modifier_option'->>'name', '') AS nm,
             COALESCE((opt->>'quantity')::numeric, 1)     AS qty
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p->'options') = 'array' THEN p->'options' ELSE '[]'::jsonb END
      ) AS opt
    ) m
    WHERE m.nm IS NOT NULL
  ),
  COALESCE((p->>'quantity')::numeric, 0),
  COALESCE((p->>'returned_quantity')::numeric, 0),
  COALESCE((p->>'unit_price')::numeric, 0),
  COALESCE((p->>'total_price')::numeric, 0)
FROM orders o
CROSS JOIN LATERAL jsonb_array_elements(o.raw_qr_data->'foodics_order'->'products') AS p
WHERE jsonb_typeof(o.raw_qr_data->'foodics_order'->'products') = 'array';

-- ── (د) RPC: التجميع على (product + modifiers) وإرجاع الاسم والمكوّنات منفصلين ──
CREATE OR REPLACE FUNCTION rpc_top_products(
  p_from timestamptz, p_branch_id uuid DEFAULT NULL, p_limit int DEFAULT 10
) RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH items AS (
  SELECT oi.product_id, oi.product_name, COALESCE(oi.modifiers, '') AS modifiers, oi.branch_id,
         (oi.quantity - oi.returned_quantity) AS qty,
         oi.total_price AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.created_at >= p_from
    AND o.status <> 'cancelled'
    AND (p_branch_id IS NULL OR oi.branch_id = p_branch_id)
),
overall AS (
  SELECT COALESCE(product_name, '؟') AS name, modifiers,
         SUM(qty) AS qty, SUM(revenue) AS revenue
  FROM items
  GROUP BY COALESCE(product_id, product_name), COALESCE(product_name, '؟'), modifiers
  ORDER BY SUM(qty) DESC
  LIMIT p_limit
),
per_branch AS (
  SELECT b.name_ar AS branch, t.name, t.modifiers, t.qty, t.revenue
  FROM branches b
  LEFT JOIN LATERAL (
    SELECT i.product_name AS name, i.modifiers, SUM(i.qty) AS qty, SUM(i.revenue) AS revenue
    FROM items i
    WHERE i.branch_id = b.id
    GROUP BY COALESCE(i.product_id, i.product_name), i.product_name, i.modifiers
    ORDER BY SUM(i.qty) DESC
    LIMIT 1
  ) t ON true
  WHERE b.is_active AND (p_branch_id IS NULL OR b.id = p_branch_id)
)
SELECT jsonb_build_object(
  'overall', (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('name', name, 'modifiers', modifiers, 'qty', qty, 'revenue', revenue)
      ORDER BY qty DESC
    ), '[]'::jsonb) FROM overall
  ),
  'by_branch', (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object('branch', branch, 'name', name, 'modifiers', modifiers, 'qty', qty, 'revenue', revenue)
      ORDER BY qty DESC NULLS LAST
    ), '[]'::jsonb) FROM per_branch
  )
);
$$;

GRANT EXECUTE ON FUNCTION rpc_top_products(timestamptz, uuid, int) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
