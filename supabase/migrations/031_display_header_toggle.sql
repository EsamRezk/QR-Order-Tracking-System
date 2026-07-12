-- ═══════════════════════════════════════════════════════════════════
-- 031: إظهار/إخفاء هيدر شاشة العرض — توجل من شاشة الفرع
-- ═══════════════════════════════════════════════════════════════════
-- عمود جديد على branch_settings يُضبط من شاشة الفرع ويُطبَّق realtime
-- على شاشة العرض:
--   true  (افتراضي) → الهيدر (الساعة/اسم الفرع/عداد الطلبات) ظاهر.
--   false           → الهيدر مخفي وتتمدد شبكة الطلبات مكانه.

ALTER TABLE branch_settings
  ADD COLUMN IF NOT EXISTS show_header BOOLEAN NOT NULL DEFAULT true;

-- تحديث bootstrap ليُرجع الإعداد الجديد ضمن display_setting (رحلة واحدة)
CREATE OR REPLACE FUNCTION rpc_branch_bootstrap(p_branch_code text)
RETURNS jsonb
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_branch branches%ROWTYPE;
BEGIN
  SELECT * INTO v_branch FROM branches WHERE code = p_branch_code AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('branch', null);
  END IF;

  RETURN jsonb_build_object(
    'branch', to_jsonb(v_branch),
    'orders', COALESCE((
      SELECT jsonb_agg(o)
      FROM (
        (SELECT * FROM v_orders_display
          WHERE branch_id = v_branch.id AND status IN ('new', 'preparing', 'ready')
          ORDER BY created_at DESC)
        UNION ALL
        (SELECT * FROM v_orders_display
          WHERE branch_id = v_branch.id AND status = 'completed'
          ORDER BY completed_at DESC NULLS LAST
          LIMIT 50)
      ) o
    ), '[]'::jsonb),
    'display_setting', (
      SELECT jsonb_build_object(
        'show_all_on_display', show_all_on_display,
        'display_mode', display_mode,
        'show_header', show_header
      )
      FROM branch_settings WHERE branch_id = v_branch.id
    )
  );
END $$;

GRANT EXECUTE ON FUNCTION rpc_branch_bootstrap(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
