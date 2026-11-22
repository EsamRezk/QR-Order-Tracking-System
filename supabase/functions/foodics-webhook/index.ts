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
//   ⚠️ قاعدة التسليم (2026-11-22): Delivered (5) يقفل الطلب عندنا **فقط** لو
//   الطلب عدّى بـ Ready قبلها (Sent to Kitchen → Ready → Delivered).
//   السبب: طباعة الفاتورة في فوديكس بتعلّم الطلب Delivered فوراً وهو لسه
//   بيتحضّر (قفزة 1 → 5). في الحالة دي الطلب يفضل "قيد التحضير" عندنا،
//   ونعلّمه raw_qr_data.foodics_delivered_early = true علشان:
//     - أي صدى 5 لاحق من فوديكس ما يقفلوش (حتى بعد ما المطبخ يضغط "جهز")
//     - foodics-update-status ما يبعتش Ready/Delivered لفوديكس (منع رجوع الحالة هناك)
//   الإقفال وقتها بزر "تم التسليم" عندنا عادي.
//
// الـ delivery webhook يحمل **الطلب الكامل** داخل payload.order. لذلك نقرأه مباشرة
// بلا أي نداء API (يتجنّب مشكلة الصلاحيات + حدّ المعدّل). مسار احتياطي: GET /orders.
//
// قواعد الموثوقية: idempotency على foodics_order_id، forward-only (لا تراجع للحالة)،
// الرد 200 فوراً قبل أي نداء للقاعدة (المعالجة في الخلفية عبر EdgeRuntime.waitUntil)،
// تخزين الطلب الخام في raw_qr_data. ⚠️ ثمن الرد الفوري: لو فشلت المعالجة الخلفية
// فوديكس لن تعيد الإرسال — الحدث التالي لنفس الطلب (orders.updated) يعوّضه غالباً.
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
import { notifyBranch, deliveryAppName } from '../_shared/push.ts'

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

// تنفيذ مهمة بعد إرسال الرد (Supabase background tasks). لو البيئة لا تدعم
// waitUntil (تشغيل محلي قديم) نكتفي بإطلاق الـ Promise بلا انتظار.
function background(task: Promise<unknown>) {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime
  if (rt?.waitUntil) {
    rt.waitUntil(task)
  } else {
    task.catch((e) => console.error('background task error:', e))
  }
}

type WebhookResult = Record<string, unknown> & { status: string }

// المعالجة الفعلية (قاعدة البيانات + جلب احتياطي من فوديكس) — تعمل في الخلفية
// بعد الرد على فوديكس، فلا تؤثر على مهلة الـ 4 ثوانٍ مهما تأخرت القاعدة.
async function processOrder(
  embeddedOrder: Record<string, any> | null,
  orderId: string,
): Promise<WebhookResult> {
  try {
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
        return ({ status: 'config_missing' })
      }
      const fetched = await fetchOrder(config.api_base_url, config.access_token, orderId)
      if (!fetched.ok || !fetched.order) {
        console.error('Failed to fetch order from Foodics', orderId, 'status:', fetched.status)
        return ({ status: 'fetch_failed', http_status: fetched.status, foodics_order_id: orderId })
      }
      order = fetched.order
    }
    if (!order) return ({ status: 'no_order_data', foodics_order_id: orderId })

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

    // الطلب الموجود محلياً (idempotency + forward-only + تأكيد المزامنة)
    const { data: existing } = await supabase
      .from('orders')
      .select('id, status, foodics_delivery_status, synced_to_foodics, delivered_early:raw_qr_data->foodics_delivered_early')
      .eq('foodics_order_id', orderId)
      .maybeSingle()

    // 1) إلغاء: declined / void → cancelled  (الأرقام في foodics-status.ts)
    if (isCancelledOrderStatus(orderStatus)) {
      if (existing) {
        // حماية البيانات: طلب مكتمل (مُسلَّم فعلاً) أو ملغى بالفعل لا يُمَس —
        // لا نفقد سجل التسليم وتوقيتاته بسبب إلغاء متأخر من فوديكس.
        if (existing.status === 'completed' || existing.status === 'cancelled') {
          console.log('Skipping cancel on terminal order', existing.id, '| status:', existing.status)
          return ({ status: 'skipped_cancel_terminal', from: existing.status, order_id: existing.id })
        }
        await supabase.from('orders')
          .update({
            status: 'cancelled',
            foodics_delivery_status: deliveryStatus,
            // الإلغاء جاء من فوديكس نفسها → فوديكس تعرفه بالفعل، لا مزامنة عكسية مطلوبة
            synced_to_foodics: true,
          })
          .eq('id', existing.id)
        return ({ status: 'cancelled', order_id: existing.id })
      }
      return ({ status: 'ignored_cancelled_unknown', foodics_order_id: orderId })
    }

    // تحديد الحالة المحلية المستهدفة من delivery_status (الخريطة في foodics-status.ts)
    // delivery_status = null أو قيم وسيطة (Assigned/Enroute تتولاها فوديكس) → لا تغيير حالة
    const targetStatus = deliveryStatusToLocal(deliveryStatus)
    if (!targetStatus) {
      return ({ status: 'no_actionable_delivery_status', delivery_status: deliveryStatus, foodics_order_id: orderId })
    }

    // قاعدة التسليم: Delivered من فوديكس يقفل الطلب فقط لو عدّى بـ Ready قبلها.
    // قفزة مباشرة (Sent to Kitchen → Delivered) = طباعة فاتورة والطلب لسه بيتحضّر
    // → الحالة عندنا ما تتغيرش. (لو الطلب علّمناه early قبل كده، Ready المحلية
    // جاية من زرنا مش من فوديكس → برضه ما نقفلوش.)
    if (
      targetStatus === 'completed' &&
      existing &&
      ['new', 'preparing', 'ready'].includes(existing.status) &&
      (existing.status !== 'ready' || existing.delivered_early === true)
    ) {
      if (existing.delivered_early !== true) {
        await supabase.from('orders')
          .update({ raw_qr_data: { foodics_order: order, foodics_delivered_early: true } })
          .eq('id', existing.id)
      }
      console.log('Delivered without Ready — kept', existing.status, '| order:', existing.id)
      return ({ status: 'skipped_delivered_without_ready', at: existing.status, order_id: existing.id })
    }

    // الحالة نفسها بالفعل → no-op (غالباً صدى الـ PUT الصادر منا):
    //   - لا نعيد ختم ready_at/completed_at (كان يفسد prep_duration_seconds)
    //   - نستغل الصدى كتأكيد مزامنة مجاني: إن طابق delivery_status ما هو مخزّن
    //     نرفع synced_to_foodics فيتخطى الـ sweeper هذا الطلب.
    if (existing && existing.status === targetStatus) {
      if (
        deliveryStatus !== null &&
        Number(existing.foodics_delivery_status) === deliveryStatus &&
        existing.synced_to_foodics === false
      ) {
        await supabase.from('orders')
          .update({ synced_to_foodics: true })
          .eq('id', existing.id)
          .eq('synced_to_foodics', false)
        console.log('Echo confirmed sync:', existing.id, '| delivery_status:', deliveryStatus)
        return ({ status: 'echo_sync_confirmed', order_id: existing.id })
      }
      return ({ status: 'noop_same_status', order_id: existing.id, at: targetStatus })
    }

    // forward-only صارم: لا نُرجِع الحالة للخلف، ولا نقفز بين الحالات النهائية
    // (completed ↔ cancelled لهما نفس الرتبة — الانتقال بينهما محجوب حفاظاً على السجل)
    if (existing && STATUS_RANK[targetStatus] <= STATUS_RANK[existing.status]) {
      console.log('Skipping non-forward transition', existing.status, '→', targetStatus)
      return ({ status: 'skipped_backward', from: existing.status, to: targetStatus, order_id: existing.id })
    }

    if (existing) {
      // تحديث طلب موجود (delivery.updated) — التغيير قادم من فوديكس نفسها،
      // إذن فوديكس تعرفه بالفعل: synced_to_foodics=true (يمنع PUT ارتدادي من الـ sweeper)
      const patch: Record<string, any> = {
        status: targetStatus,
        foodics_delivery_status: deliveryStatus,
        synced_to_foodics: true,
      }
      if (targetStatus === 'ready') patch.ready_at = new Date().toISOString()
      if (targetStatus === 'completed') patch.completed_at = new Date().toISOString()
      await supabase.from('orders').update(patch).eq('id', existing.id)
      console.log('Order updated:', existing.id, '→', targetStatus)
      return ({ status: 'updated', order_id: existing.id, to: targetStatus })
    }

    // إنشاء طلب جديد — فقط عندما يدخل المطبخ (preparing). الحالات اللاحقة بلا سجل سابق نتجاهلها.
    if (targetStatus !== 'preparing') {
      return ({ status: 'ignored_unknown_order', to: targetStatus, foodics_order_id: orderId })
    }

    if (!foodicsBranchId) {
      console.error('Order has no branch id', orderId)
      return ({ status: 'missing_branch', foodics_order_id: orderId })
    }

    const { data: mapping, error: mapErr } = await supabase
      .from('foodics_branch_mapping')
      .select('branch_id')
      .eq('foodics_branch_id', foodicsBranchId)
      .maybeSingle()
    if (mapErr || !mapping) {
      console.error('Branch mapping not found:', foodicsBranchId, mapErr)
      return ({ status: 'branch_not_found', foodics_branch_id: foodicsBranchId })
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
        // الطلب قادم من فوديكس نفسها → حالته الحالية معروفة لديها بالفعل،
        // لا مزامنة عكسية مطلوبة (يمنع الـ sweeper من PUT ارتدادي بلا داعٍ)
        synced_to_foodics: true,
        raw_qr_data: { foodics_order: order },
      })
      // delivery_app / app_number يملؤهما trigger orders_analytics_fields (migration 027)
      .select('id, delivery_app, app_number')
      .single()

    if (insErr) {
      // تكرار تسابقي محتمل (unique index) — نعتبره نجاحاً صامتاً
      console.error('Insert error:', insErr)
      return ({ status: 'insert_error', message: insErr.message })
    }

    console.log('Order created (preparing):', newOrder.id, '| foodics:', orderId)

    // تنبيه موبايلات الفرع (Web Push — migration 035). فشله لا يؤثر على الطلب.
    try {
      const { data: br } = await supabase
        .from('branches')
        .select('name_ar, code')
        .eq('id', mapping.branch_id)
        .maybeSingle()
      const appName = deliveryAppName(newOrder.delivery_app)
      const displayNumber = newOrder.app_number || foodicsOrderNumber
      const push = await notifyBranch(supabase, mapping.branch_id, {
        title: `طلب جديد #${displayNumber}`,
        body: [appName, br?.name_ar ? `فرع ${br.name_ar}` : null].filter(Boolean).join(' — ') || 'كبة زون',
        url: br?.code ? `/kitchen?branch=${br.code}` : '/',
        tag: `order-${newOrder.id}`,
      })
      if (push.sent || push.failed || push.removed) console.log('push', newOrder.id, JSON.stringify(push))
    } catch (pushErr) {
      console.error('push error', newOrder.id, pushErr)
    }

    return ({ status: 'created', order_id: newOrder.id })
  } catch (err) {
    console.error('Webhook error:', orderId, err)
    return ({ status: 'error', message: (err as Error).message })
  }
}

// ── نقطة الدخول: رد فوري (2xx) ثم المعالجة في الخلفية ──
// طلب فوديكس (إيميل 2026-11): الرد خلال ~4 ثوانٍ وإلا يُحتسب فشلاً ويُعاد
// الإرسال (يضاعف الحمل). لذلك لا نلمس القاعدة قبل الرد إطلاقاً.
// ⚠️ لا نطبع الـ payload كاملاً: كان سبب تجاوز حصة السجلات (Log Ingestion).
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: Record<string, any>
  try {
    payload = await req.json()
  } catch {
    return json({ status: 'invalid_json' }, 400)
  }

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
    console.error('No order id in webhook payload | event:', event)
    return json({ status: 'no_order_id' })
  }

  const startedAt = Date.now()
  background(
    processOrder(embeddedOrder, String(orderId)).then((result) => {
      console.log('webhook done', event ?? '-', orderId, result.status, `${Date.now() - startedAt}ms`)
    }),
  )

  return json({ status: 'accepted', foodics_order_id: orderId })
})
