// ═══════════════════════════════════════════════════════════════════
// Edge Function: foodics-webhook  (inbound — الإنتاج)
//
// الورك فلو الجديد (KebbaZone_Foodics_Integration_Flow):
//   ✅ الأحداث المشتركة على الإنتاج (مؤكّدة 2026-06-29): orders.created + orders.updated
//   ونتعامل مع الطلب حسب status + delivery_status:
//
//   IF status ∈ {3 Declined, 7 Void}            → 'cancelled' (إزالة من العرض)
//   ELSE IF delivery_status = 1 (Sent to Kitchen) → upsert 'preparing' مباشرة (بلا استلام)
//   ELSE IF delivery_status = 2 (Ready)           → 'ready'
//   ELSE IF delivery_status ≥ 5 (Delivered/Cancel)→ 'completed'/'cancelled'
//
// الـ delivery webhook يحمل **الطلب الكامل** داخل payload.order. لذلك نقرأه مباشرة
// بلا أي نداء API (يتجنّب مشكلة الصلاحيات + حدّ المعدّل). مسار احتياطي: GET /orders.
//
// قواعد الموثوقية: idempotency على foodics_order_id، forward-only (لا تراجع للحالة)،
// الرد دائماً 200 خلال ثوانٍ، تخزين الـ payload الخام في raw_qr_data.
//
// ملاحظة أمان: فوديكس لا ترسل توقيع HMAC (غير موثّق في دليل الـ API) — لا تحقق توقيع.
//
// النشر: npx supabase functions deploy foodics-webhook --no-verify-jwt
// الرابط: https://<PROJECT_REF>.supabase.co/functions/v1/foodics-webhook
// ═══════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// 🔑 كل افتراضات حالات فوديكس في ملف واحد — عدّلها هناك فقط بعد تأكيد فوديكس.
import {
  ORDER_TYPES,
  HANDLED_EVENTS,
  STATUS_RANK,
  isCancelledOrderStatus,
  deliveryStatusToLocal,
} from '../_shared/foodics-status.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function getConfig() {
  const { data } = await supabase
    .from('foodics_config')
    .select('access_token, api_base_url')
    .limit(1)
    .maybeSingle()
  return data
}

// مسار احتياطي: جلب الطلب من فوديكس عبر الليستة بفلتر id (scope: orders.list).
// فوديكس تتجاهل filter[id] وترجع القائمة، لذا نبحث بالمعرّف بـ find لا data[0].
async function fetchOrder(baseUrl: string, token: string, orderId: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/orders?filter[id]=${encodeURIComponent(orderId)}&include=branch`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) return { ok: false, status: res.status, order: null as Record<string, any> | null }
  const body = await res.json()
  const list = Array.isArray(body?.data) ? body.data : (body?.data ? [body.data] : [])
  const order = list.find((o: Record<string, any>) => o?.id === orderId) ?? null
  if (!order) return { ok: false, status: 404, order: null as Record<string, any> | null }
  return { ok: true, status: 200, order: order as Record<string, any> }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const payload = await req.json()
    console.log('RAW WEBHOOK PAYLOAD:', JSON.stringify(payload))

    const event = payload?.event
    if (event && !HANDLED_EVENTS.has(event)) {
      return json({ status: 'ignored', event })
    }

    // هل الـ webhook يحمل الطلب كاملاً؟ (المتوقع لأحداث delivery)
    const embeddedOrder =
      payload?.order && typeof payload.order === 'object' ? payload.order : null

    const orderId =
      embeddedOrder?.id ?? payload?.entity?.id ?? payload?.data?.id ?? payload?.id
    if (!orderId) {
      console.error('No order id in webhook payload')
      return json({ status: 'no_order_id' })
    }

    // الحصول على تفاصيل الطلب: (أ) مضمّن في الـ webhook، أو (ب) جلب احتياطي
    let order: Record<string, any> | null = null
    let usedSource = 'webhook'
    if (embeddedOrder && (embeddedOrder.branch?.id ?? embeddedOrder.branch_id)) {
      order = embeddedOrder
    } else {
      usedSource = 'api'
      const config = await getConfig()
      if (!config?.access_token) {
        console.error('foodics_config not set (missing access_token)')
        return json({ status: 'config_missing' })
      }
      const fetched = await fetchOrder(config.api_base_url, config.access_token, orderId)
      if (!fetched.ok || !fetched.order) {
        console.error('Failed to fetch order from Foodics', orderId, 'status:', fetched.status)
        return json({ status: 'fetch_failed', http_status: fetched.status, foodics_order_id: orderId })
      }
      order = fetched.order
    }
    if (!order) return json({ status: 'no_order_data', foodics_order_id: orderId })

    // استخراج الحقول
    const orderStatus = Number(order.status)            // 1..8
    const deliveryStatus = order.delivery_status == null ? null : Number(order.delivery_status) // 1..6 | null
    const orderSource = order.source == null ? null : Number(order.source) // 1=POS,2=API,3=CC
    const foodicsBranchId = order.branch?.id ?? order.branch_id
    const foodicsOrderNumber = (order.number ?? order.reference ?? orderId).toString()
    const orderType = ORDER_TYPES[order.type] ?? 'dine_in'

    console.log(
      'Order', orderId, '| src:', usedSource,
      '| status:', orderStatus, '| delivery_status:', deliveryStatus,
      '| order.source:', orderSource, '| branch:', foodicsBranchId, '| #', foodicsOrderNumber,
    )

    // الطلب الموجود محلياً (idempotency + forward-only)
    const { data: existing } = await supabase
      .from('orders')
      .select('id, status')
      .eq('foodics_order_id', orderId)
      .maybeSingle()

    // 1) إلغاء: declined / void → cancelled  (الأرقام في foodics-status.ts)
    if (isCancelledOrderStatus(orderStatus)) {
      if (existing) {
        await supabase.from('orders')
          .update({ status: 'cancelled', foodics_delivery_status: deliveryStatus })
          .eq('id', existing.id)
        return json({ status: 'cancelled', order_id: existing.id })
      }
      return json({ status: 'ignored_cancelled_unknown', foodics_order_id: orderId })
    }

    // تحديد الحالة المحلية المستهدفة من delivery_status (الخريطة في foodics-status.ts)
    // delivery_status = null أو قيم وسيطة (Assigned/Enroute تتولاها فوديكس) → لا تغيير حالة
    const targetStatus = deliveryStatusToLocal(deliveryStatus)
    if (!targetStatus) {
      return json({ status: 'no_actionable_delivery_status', delivery_status: deliveryStatus, foodics_order_id: orderId })
    }

    // forward-only: لا نُرجِع الحالة للخلف
    if (existing && STATUS_RANK[targetStatus] < STATUS_RANK[existing.status]) {
      console.log('Skipping backward transition', existing.status, '→', targetStatus)
      return json({ status: 'skipped_backward', from: existing.status, to: targetStatus, order_id: existing.id })
    }

    if (existing) {
      // تحديث طلب موجود (delivery.updated)
      const patch: Record<string, any> = {
        status: targetStatus,
        foodics_delivery_status: deliveryStatus,
      }
      if (targetStatus === 'ready') patch.ready_at = new Date().toISOString()
      if (targetStatus === 'completed') patch.completed_at = new Date().toISOString()
      await supabase.from('orders').update(patch).eq('id', existing.id)
      console.log('Order updated:', existing.id, '→', targetStatus)
      return json({ status: 'updated', order_id: existing.id, to: targetStatus })
    }

    // إنشاء طلب جديد — فقط عندما يدخل المطبخ (preparing). الحالات اللاحقة بلا سجل سابق نتجاهلها.
    if (targetStatus !== 'preparing') {
      return json({ status: 'ignored_unknown_order', to: targetStatus, foodics_order_id: orderId })
    }

    if (!foodicsBranchId) {
      console.error('Order has no branch id', orderId)
      return json({ status: 'missing_branch', foodics_order_id: orderId })
    }

    const { data: mapping, error: mapErr } = await supabase
      .from('foodics_branch_mapping')
      .select('branch_id')
      .eq('foodics_branch_id', foodicsBranchId)
      .maybeSingle()
    if (mapErr || !mapping) {
      console.error('Branch mapping not found:', foodicsBranchId, mapErr)
      return json({ status: 'branch_not_found', foodics_branch_id: foodicsBranchId })
    }

    const { data: newOrder, error: insErr } = await supabase
      .from('orders')
      .insert({
        order_id: foodicsOrderNumber,
        branch_id: mapping.branch_id,
        status: 'preparing',           // يدخل قيد التحضير مباشرة (إلغاء خطوة الاستلام)
        scanned_at: new Date().toISOString(), // بداية احتساب مدة التحضير
        source: 'foodics',
        order_source: orderSource,
        foodics_order_id: orderId,
        foodics_order_number: foodicsOrderNumber,
        order_type: orderType,
        foodics_delivery_status: deliveryStatus,
        raw_qr_data: { foodics_order: order },
      })
      .select('id')
      .single()

    if (insErr) {
      // تكرار تسابقي محتمل (unique index) — نعتبره نجاحاً صامتاً
      console.error('Insert error:', insErr)
      return json({ status: 'insert_error', message: insErr.message })
    }

    console.log('Order created (preparing):', newOrder.id, '| foodics:', orderId)
    return json({ status: 'created', order_id: newOrder.id })
  } catch (err) {
    console.error('Webhook error:', err)
    return json({ status: 'error', message: (err as Error).message })
  }
})
