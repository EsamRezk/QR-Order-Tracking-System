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
// action='bulk_delivered' (سلة الحذف في هيدر شاشة الفرع):
//   body: { session_id, action: 'bulk_delivered', branch_id, scope }
//   scope: 'preparing' | 'ready' | 'both'
//   الترتيب معكوس عن الأكشن الفردي: المحلي أولاً (rpc_kitchen_bulk_deliver →
//   الواجهتان تتحدثان فوراً عبر Realtime) ثم PUT فوديكس لكل طلب على دفعات،
//   ويُرفع synced_to_foodics=true للناجح منها فقط.
//
// قاعدة معالجة الأخطاء (حسب الدليل): لو فشل نداء فوديكس، نحدّث المحلي على أي حال
// (synced_to_foodics=false) حتى لا يتوقف المطبخ، ويُعاد المزامنة لاحقاً.
//
// تُستدعى من المتصفح → تحتاج CORS + معالجة OPTIONS.
//
// النشر: npx supabase functions deploy foodics-update-status --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// 🔑 كل افتراضات حالات فوديكس في ملف واحد — عدّلها هناك فقط بعد تأكيد فوديكس.
import { outboundBody, outboundPath } from '../_shared/foodics-status.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const { session_id, order_internal_id, action, branch_id, scope } = await req.json()

    // ── التحويل الجماعي (سلة الحذف) ──
    if (action === 'bulk_delivered') {
      if (!session_id || !branch_id || !['preparing', 'ready', 'both'].includes(scope)) {
        return json({ success: false, error: 'بيانات غير صحيحة' }, 400)
      }
      return await handleBulkDelivered(session_id, branch_id, scope, req.headers.get('user-agent') ?? 'kitchen')
    }

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
        const body = outboundBody(action) // الحقول/القيم في foodics-status.ts
        const url = `${base}${outboundPath(order.foodics_order_id)}`
        // تشخيصي: يكشف لو الرابط Sandbox بالغلط أو الأوردر/التوكن غير متطابقين عند 404
        console.log('Foodics PUT →', url, '| body:', JSON.stringify(body))
        try {
          const res = await fetch(url, {
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
            console.error('Foodics PUT failed', res.status, '| url:', url, '|', await res.text())
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

// ═══════════════════════════════════════════════════════════════════
// التحويل الجماعي إلى "تم الاستلام" (سلة الحذف)
// 1) rpc_kitchen_bulk_deliver: تتحقق من الجلسة وتحوّل الطلبات المطابقة
//    محلياً دفعة واحدة (completed) وترجع قائمتها — الواجهتان تتحدثان فوراً.
// 2) PUT فوديكس delivery_status=5 لكل طلب foodics على دفعات من 5،
//    ثم رفع synced_to_foodics=true للناجح منها فقط.
// ═══════════════════════════════════════════════════════════════════
async function handleBulkDelivered(
  sessionId: string,
  branchId: string,
  scope: string,
  deviceInfo: string,
): Promise<Response> {
  // 1) التحديث المحلي الجماعي عبر RPC مؤمّنة
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_kitchen_bulk_deliver', {
    p_session_id: sessionId,
    p_branch_id: branchId,
    p_scope: scope,
    p_device_info: deviceInfo,
  })
  if (rpcErr) {
    console.error('bulk RPC error:', rpcErr)
    return json({ success: false, error: rpcErr.message }, 500)
  }
  if (rpcRes && rpcRes.success === false) {
    return json({ success: false, error: rpcRes.error }, 200)
  }

  const orders: { id: string; source: string; foodics_order_id: string | null }[] =
    rpcRes?.orders ?? []
  const foodicsOrders = orders.filter(o => o.source === 'foodics' && o.foodics_order_id)

  // 2) مزامنة فوديكس — فشلها لا يفشل العملية (المحلي اتحدّث بالفعل)
  let syncedCount = 0
  if (foodicsOrders.length > 0) {
    const config = await getConfig()
    if (config?.access_token) {
      const base = (config.api_base_url || 'https://api.foodics.com/v5').replace(/\/$/, '')
      const syncedIds: string[] = []

      const BATCH = 5
      for (let i = 0; i < foodicsOrders.length; i += BATCH) {
        await Promise.all(foodicsOrders.slice(i, i + BATCH).map(async (o) => {
          try {
            const res = await fetch(`${base}${outboundPath(o.foodics_order_id!)}`, {
              method: 'PUT',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.access_token}`,
              },
              body: JSON.stringify(outboundBody('delivered')),
            })
            if (res.ok) {
              syncedIds.push(o.id)
            } else {
              console.error('Bulk Foodics PUT failed', res.status, '| order:', o.foodics_order_id, '|', await res.text())
            }
          } catch (e) {
            console.error('Bulk Foodics PUT exception:', o.foodics_order_id, e)
          }
        }))
      }

      syncedCount = syncedIds.length
      if (syncedIds.length > 0) {
        const { error: updErr } = await supabase
          .from('orders')
          .update({ synced_to_foodics: true })
          .in('id', syncedIds)
        if (updErr) console.error('bulk synced flag update error:', updErr)
      }
    } else {
      console.error('foodics_config missing access_token — skipping bulk Foodics sync')
    }
  }

  return json({
    success: true,
    count: rpcRes?.count ?? orders.length,
    foodics_total: foodicsOrders.length,
    foodics_synced: syncedCount,
  })
}
