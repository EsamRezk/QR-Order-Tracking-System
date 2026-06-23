-- ═══════════════════════════════════════════════════
-- 017: Kitchen flow RPC — accept order (new → preparing)
-- ═══════════════════════════════════════════════════
-- زر "جاهز" يعيد استخدام rpc_scanner_mark_ready الموجود (preparing → ready).

CREATE OR REPLACE FUNCTION rpc_kitchen_accept_order(
  p_session_id        UUID,
  p_order_internal_id UUID,
  p_device_info       TEXT
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role NOT IN ('admin', 'user') THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- new → preparing + إعادة ضبط scanned_at لبداية التجهيز الفعلية
  UPDATE orders
  SET status      = 'preparing',
      accepted_at = now(),
      scanned_at  = now(),
      accepted_by = v_user.user_id::TEXT
  WHERE id = p_order_internal_id AND status = 'new';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الطلب غير متاح للاستلام');
  END IF;

  INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
  VALUES (p_order_internal_id, 'accept', v_user.user_id::TEXT, p_device_info);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
