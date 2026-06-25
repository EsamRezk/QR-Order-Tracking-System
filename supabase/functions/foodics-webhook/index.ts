// ═══════════════════════════════════════════════════════════════════
// Edge Function: foodics-webhook  (الإنتاج)
//
// يستقبل webhook من Foodics عند order.created.
//
// الـ Order Webhook يحمل **الطلب الكامل** داخل payload.order (الفرع/الرقم/النوع).
// لذلك المسار الأساسي:
//   1) نقرأ الطلب مباشرة من payload.order (بدون أي نداء API)
//   2) نربط الفرع ثم ننشئ الطلب بحالة 'new'
// هذا يتجنّب: مشكلة الصلاحيات (403)، حدّ المعدّل (90/دقيقة)، وزمن النداء الإضافي،
// ويبقينا ضمن مهلة فوديكس (5 ثوانٍ) بسهولة.
//
// مسار احتياطي (fallback): لو لم يحمل الـ webhook الطلب كاملاً، نجلبه عبر
// GET /orders?filter[id]={id} (scope: orders.list).
//
// إعداد البيئة في قاعدة هذا المشروع (الإنتاج):
//   foodics_config.api_base_url = https://api.foodics.com/v5
//
// النشر: npx supabase functions deploy foodics-webhook --no-verify-jwt
// الرابط: https://<PROD_PROJECT_REF>.supabase.co/functions/v1/foodics-webhook
// الحدث في Foodics: order.created
// ═══════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Foodics order type → التسمية الداخلية
const ORDER_TYPES: Record<number, string> = {
  1: 'dine_in',
  2: 'pickup',
  3: 'delivery',
  4: 'drive_thru',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// جلب إعدادات Foodics (token + base URL) — صف واحد
async function getConfig() {
  const { data } = await supabase
    .from('foodics_config')
    .select('access_token, api_base_url')
    .limit(1)
    .maybeSingle()
  return data
}

// جلب تفاصيل الطلب الكاملة من Foodics (مسار احتياطي فقط)
// نستخدم endpoint الليستة بفلتر id (scope: orders.list). فوديكس تتجاهل filter[id]
// وترجع القائمة، لذا نبحث عن الطلب بمعرّفه بـ find لا data[0].
async function fetchOrder(baseUrl: string, token: string, orderId: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/orders?filter[id]=${encodeURIComponent(orderId)}&include=branch`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    return { ok: false, status: res.status, order: null as Record<string, any> | null }
  }
  const body = await res.json()
  const list = Array.isArray(body?.data) ? body.data : (body?.data ? [body.data] : [])
  const order = list.find((o: Record<string, any>) => o?.id === orderId) ?? null
  if (!order) {
    return { ok: false, status: 404, order: null as Record<string, any> | null }
  }
  return { ok: true, status: 200, order: order as Record<string, any> }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const payload = await req.json()

    // نهتم فقط بـ order.created
    const event = payload?.event
    if (event !== 'order.created') {
      return json({ status: 'ignored', event })
    }

    // هل الـ webhook يحمل الطلب كاملاً؟
    const embeddedOrder =
      payload?.order && typeof payload.order === 'object' ? payload.order : null

    // معرّف الطلب — من الطلب المضمّن أو من entity.id (fallback دفاعي)
    const orderId =
      embeddedOrder?.id ?? payload?.entity?.id ?? payload?.data?.id ?? payload?.id
    if (!orderId) {
      console.error('No order id in webhook payload', JSON.stringify(payload))
      return json({ status: 'no_order_id' })
    }

    // منع التكرار مبكراً
    const { data: dup } = await supabase
      .from('orders')
      .select('id')
      .eq('foodics_order_id', orderId)
      .maybeSingle()
    if (dup) {
      return json({ status: 'duplicate', foodics_order_id: orderId })
    }

    // الحصول على تفاصيل الطلب:
    // (أ) المسار الأساسي — الطلب مضمّن في الـ webhook ويحمل الفرع → نستخدمه مباشرة (بدون API)
    // (ب) المسار الاحتياطي — نجلبه من فوديكس
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
        // نرد 200 دائماً حتى لا يحظر Foodics الـ endpoint
        return json({ status: 'fetch_failed', http_status: fetched.status, foodics_order_id: orderId })
      }
      order = fetched.order
    }

    if (!order) {
      return json({ status: 'no_order_data', foodics_order_id: orderId })
    }

    // استخراج الحقول من الطلب الكامل
    const foodicsBranchId = order.branch?.id ?? order.branch_id
    const foodicsOrderNumber = (order.number ?? order.reference ?? orderId).toString()
    const orderType = ORDER_TYPES[order.type] ?? 'dine_in'

    if (!foodicsBranchId) {
      console.error('Order has no branch id', orderId)
      return json({ status: 'missing_branch', foodics_order_id: orderId })
    }

    // ربط الفرع
    const { data: mapping, error: mapErr } = await supabase
      .from('foodics_branch_mapping')
      .select('branch_id')
      .eq('foodics_branch_id', foodicsBranchId)
      .maybeSingle()
    if (mapErr || !mapping) {
      console.error('Branch mapping not found:', foodicsBranchId, mapErr)
      return json({ status: 'branch_not_found', foodics_branch_id: foodicsBranchId })
    }

    // إنشاء الطلب بحالة 'new' — يظهر في المطبخ كطلب جديد
    const { data: newOrder, error: insErr } = await supabase
      .from('orders')
      .insert({
        order_id: foodicsOrderNumber,
        branch_id: mapping.branch_id,
        status: 'new',
        source: 'foodics',
        foodics_order_id: orderId,
        foodics_order_number: foodicsOrderNumber,
        order_type: orderType,
        raw_qr_data: { foodics_order: order },
      })
      .select('id')
      .single()

    if (insErr) {
      // قد يكون تكراراً تسابقياً (unique index) — نعتبره خطأ إدخال
      console.error('Insert error:', insErr)
      return json({ status: 'insert_error', message: insErr.message })
    }

    console.log('Order created:', newOrder.id, '| source:', usedSource, '| foodics:', orderId, '| branch:', foodicsBranchId, '| #', foodicsOrderNumber)
    return json({ status: 'created', order_id: newOrder.id })
  } catch (err) {
    console.error('Webhook error:', err)
    // دائماً 200 عند الخطأ الداخلي حتى لا يحظر Foodics الـ endpoint
    return json({ status: 'error', message: (err as Error).message })
  }
})
