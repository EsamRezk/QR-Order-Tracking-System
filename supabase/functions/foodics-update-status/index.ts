// ═══════════════════════════════════════════════════════════════════
// Edge Function: foodics-update-status  (outbound)
//
// تُستدعى من شاشة المطبخ عند ضغط الموظف زر "جاهز" أو "تم التسليم".
// تنفّذ شيئين:
//   1) تحديث فوديكس: PUT /orders/{id}
//        action='ready'     → { delivery_status: 2 }
//        action='delivered' → { delivery_status: 5, driver_collected_at: <UTC now> }
//        (scope مطلوب: orders.limited.deliver)
//   2) تحديث القاعدة محلياً عبر RPC مؤمّنة (تتحقق من الجلسة وتسجّل + synced_to_foodics).
//
// قاعدة معالجة الأخطاء (حسب الدليل): لو فشل نداء فوديكس، نحدّث المحلي على أي حال
// (synced_to_foodics=false) حتى لا يتوقف المطبخ، ويُعاد المزامنة لاحقاً.
//
// تُستدعى من المتصفح → تحتاج CORS + معالجة OPTIONS.
//
// النشر: npx supabase functions deploy foodics-update-status --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
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

// توقيت UTC بصيغة فوديكس: YYYY-MM-DD HH:MM:SS
function utcNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const { session_id, order_internal_id, action } = await req.json()

    if (!session_id || !order_internal_id || !['ready', 'delivered'].includes(action)) {
      return json({ success: false, error: 'بيانات غير صحيحة' }, 400)
    }

    // 1) جلب الطلب المحلي (service role)
    const { data: order, error: ordErr } = await supabase
      .from('orders')
      .select('id, status, source, foodics_order_id')
      .eq('id', order_internal_id)
      .maybeSingle()
    if (ordErr || !order) {
      return json({ success: false, error: 'الطلب غير موجود' }, 404)
    }

    // 2) نداء فوديكس (فقط لطلبات فوديكس التي تملك معرّفاً)
    let synced = false
    let foodicsHttp: number | null = null
    if (order.source === 'foodics' && order.foodics_order_id) {
      const config = await getConfig()
      if (config?.access_token) {
        const base = (config.api_base_url || 'https://api.foodics.com/v5').replace(/\/$/, '')
        const body = action === 'ready'
          ? { delivery_status: 2 }
          : { delivery_status: 5, driver_collected_at: utcNow() }
        try {
          const res = await fetch(`${base}/orders/${encodeURIComponent(order.foodics_order_id)}`, {
            method: 'PUT',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.access_token}`,
            },
            body: JSON.stringify(body),
          })
          foodicsHttp = res.status
          synced = res.ok
          if (!res.ok) {
            console.error('Foodics PUT failed', res.status, await res.text())
          }
        } catch (e) {
          console.error('Foodics PUT exception:', e)
        }
      } else {
        console.error('foodics_config missing access_token — skipping Foodics sync')
      }
    }

    // 3) تحديث القاعدة محلياً عبر RPC مؤمّنة (تتحقق من الجلسة + تسجّل + تضبط synced)
    const rpcName = action === 'ready' ? 'rpc_kitchen_mark_ready_synced' : 'rpc_kitchen_mark_delivered'
    const { data: rpcRes, error: rpcErr } = await supabase.rpc(rpcName, {
      p_session_id: session_id,
      p_order_internal_id: order_internal_id,
      p_device_info: req.headers.get('user-agent') ?? 'kitchen',
      p_synced: synced,
    })
    if (rpcErr) {
      console.error('RPC error:', rpcErr)
      return json({ success: false, error: rpcErr.message, synced, foodics_http: foodicsHttp }, 500)
    }
    if (rpcRes && rpcRes.success === false) {
      return json({ success: false, error: rpcRes.error, synced, foodics_http: foodicsHttp }, 200)
    }

    return json({ success: true, synced, foodics_http: foodicsHttp })
  } catch (err) {
    console.error('update-status error:', err)
    return json({ success: false, error: (err as Error).message }, 500)
  }
})
