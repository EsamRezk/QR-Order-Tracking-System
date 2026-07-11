-- ═══════════════════════════════════════════════════════════════════
-- 028: شاشة الفرع وشاشة العرض — تحميل أولي برحلة واحدة (bootstrap RPC)
-- ═══════════════════════════════════════════════════════════════════
-- المشكلة: عند فتح /kitchen أو /display الواجهة كانت تنتظر 3 نداءات
-- متتالية (waterfall): useBranch (يجلب الفرع بالـ code) ← بعدها فقط
-- تنطلق useOrders + useBranchDisplaySetting (تحتاجان branch.id). كل نداء
-- على شبكة الإنتاج ياخذ ~700ms-1s (زمن ثابت لكل رحلة بغض النظر عن حجم
-- البيانات)، فمجموع الانتظار قبل ظهور أول طلب كان ~1.5-2 ثانية، تماماً
-- مثل مشكلة التحليلات (migration 027) لكن سببها هنا عدد الرحلات لا
-- ضخامة الـ payload.
--
-- الحل: RPC واحدة تاخذ كود الفرع وتُرجع الفرع + الطلبات (نفس تقليم
-- raw_qr_data المستخدم في v_orders_display) + إعداد شاشة العرض معاً —
-- رحلة شبكة واحدة بدل ثلاث متتالية. الـ Realtime subscriptions تبقى
-- كما هي (تُفعَّل فور معرفة branch.id من نتيجة هذه الرحلة الوحيدة).

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
        'display_mode', display_mode
      )
      FROM branch_settings WHERE branch_id = v_branch.id
    )
  );
END $$;

GRANT EXECUTE ON FUNCTION rpc_branch_bootstrap(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
