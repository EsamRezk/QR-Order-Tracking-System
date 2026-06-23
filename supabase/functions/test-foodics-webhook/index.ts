// ═══════════════════════════════════════════════════════════════════
// Edge Function: test-foodics-webhook
//
// يستقبل webhook من Foodics عند order.created.
// مهم: حسب توثيق Foodics، الـ webhook يرسل معرّف الكيان فقط:
//   { timestamp, event, business:{name,reference}, entity:{type,id} }
// أي أنه لا يحمل تفاصيل الطلب (الفرع/الرقم/النوع). لذلك:
//   1) نأخذ entity.id (معرّف الطلب)
//   2) نجلب الطلب الكامل عبر GET /orders/{id} باستخدام access_token الخاص بنا
//   3) نربط الفرع ثم ننشئ الطلب بحالة 'new'
// هذا أيضاً نموذج الأمان: المعرّف وحده غير حساس، والبيانات الحقيقية تُجلب
// بتوكننا الخاص — أي معرّف مزيّف يُرجع 404 فنتجاهله.
//
// النشر: supabase functions deploy test-foodics-webhook --no-verify-jwt
// الرابط: https://<PROJECT_REF>.supabase.co/functions/v1/test-foodics-webhook
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

// جلب تفاصيل الطلب الكاملة من Foodics
async function fetchOrder(baseUrl: string, token: string, orderId: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/orders/${orderId}?include=branch`
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
  return { ok: true, status: 200, order: (body?.data ?? body) as Record<string, any> }
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

    // معرّف الطلب — الـ webhook يرسل entity.id (مع fallback دفاعي)
    const orderId =
      payload?.entity?.id ?? payload?.data?.id ?? payload?.order?.id ?? payload?.id
    if (!orderId) {
      console.error('No order id in webhook payload', payload)
      return json({ status: 'no_order_id' })
    }

    // منع التكرار مبكراً (قبل استدعاء API)
    const { data: dup } = await supabase
      .from('orders')
      .select('id')
      .eq('foodics_order_id', orderId)
      .maybeSingle()
    if (dup) {
      return json({ status: 'duplicate', foodics_order_id: orderId })
    }

    // إعدادات Foodics
    const config = await getConfig()
    if (!config?.access_token) {
      console.error('foodics_config not set (missing access_token)')
      return json({ status: 'config_missing' })
    }

    // جلب تفاصيل الطلب
    const { ok, status, order } = await fetchOrder(config.api_base_url, config.access_token, orderId)
    if (!ok || !order) {
      console.error('Failed to fetch order from Foodics', orderId, 'status:', status)
      // نرد 200 دائماً حتى لا يحظر Foodics الـ endpoint
      return json({ status: 'fetch_failed', http_status: status, foodics_order_id: orderId })
    }

    // استخراج الحقول من الطلب الكامل
    const foodicsBranchId = order.branch?.id ?? order.branch_id
    const foodicsOrderNumber = (order.number ?? order.reference ?? orderId).toString()
    const orderType = ORDER_TYPES[order.type] ?? 'dine_in'

    if (!foodicsBranchId) {
      console.error('Order has no branch id', orderId, order)
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

    console.log('Order created:', newOrder.id, 'foodics:', orderId)
    return json({ status: 'created', order_id: newOrder.id })
  } catch (err) {
    console.error('Webhook error:', err)
    // دائماً 200 عند الخطأ الداخلي حتى لا يحظر Foodics الـ endpoint
    return json({ status: 'error', message: (err as Error).message })
  }
})
