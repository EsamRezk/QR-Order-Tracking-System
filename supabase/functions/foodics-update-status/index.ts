// ═══════════════════════════════════════════════════════════════════
// Edge Function: foodics-update-status  (outbound — داتابيز أولاً)
//
// تُستدعى من شاشة المطبخ عند زر "جاهز" / "تم التسليم" / سلة الحذف،
// ومن pg_cron (action='resync') لإعادة محاولة المزامنات الفاشلة.
//
// الترتيب الجديد (migration 032 — Optimistic UI):
//   1) تحديث القاعدة محلياً عبر RPC مؤمّنة (سريع — الواجهات تتحدث فوراً
//      عبر Realtime). فشل الـ RPC = فشل العملية كلها وفوديكس لا تُمَس
//      (يمنع التضارب القديم: PUT يصل وفوديكس تتقدم بينما المحلي يرفض).
//   2) الرد على المتصفح فوراً بعد الـ RPC.
//   3) نداء فوديكس (PUT delivery_status) في الخلفية عبر EdgeRuntime.waitUntil
//      — يرسل دائماً "آخر حالة مخزّنة" لا حالة الزر (يمنع سباق جاهز→تسليم).
//   4) فشل الـ PUT → fn_foodics_sync_fail (عدّاد + backoff) ويتولاه الـ
//      sweeper (pg_cron كل 30 ثانية → action 'resync').
//
// action='resync' (سرّي — header x-resync-secret يطابق FOODICS_RESYNC_SECRET):
//   يلتقط حتى 15 طلباً معلقاً (synced_to_foodics=false، attempts<20،
//   next_at<=now) ويعيد إرسال حالتها المخزّنة، مع احترام 429 (إيقاف الدفعة).
//
// تُستدعى من المتصفح → تحتاج CORS + معالجة OPTIONS.
//
// النشر: npx supabase functions deploy foodics-update-status --no-verify-jwt
// السر:  npx supabase secrets set FOODICS_RESYNC_SECRET=<نفس سر vault>
// ═══════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// 🔑 كل افتراضات حالات فوديكس في ملف واحد — عدّلها هناك فقط بعد تأكيد فوديكس.
import {
  FOODICS_DELIVERY_STATUS,
  outboundBody,
  outboundPath,
  toFoodicsUtc,
} from '../_shared/foodics-status.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// أقصى محاولات للـ sweeper (متطابق مع حارس الجدولة في migration 032)
const MAX_SYNC_ATTEMPTS = 20
// حجم دفعة الـ resync (15 كل 30 ثانية = 30 طلب/دقيقة — تحت حد فوديكس 90/دقيقة)
const RESYNC_BATCH = 15
// أكواد HTTP تعني فشلاً دائماً (لا فائدة من إعادة المحاولة): طلب غير موجود/غير صالح
const PERMANENT_HTTP = new Set([404, 422])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
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

type FoodicsConfig = { access_token: string; api_base_url: string | null }

async function getConfig(): Promise<FoodicsConfig | null> {
  const { data } = await supabase
    .from('foodics_config')
    .select('access_token, api_base_url')
    .limit(1)
    .maybeSingle()
  return data as FoodicsConfig | null
}

// ═══════════════════════════════════════════════════════════════════
// نواة المزامنة: إرسال "آخر حالة مخزّنة" لطلب واحد إلى فوديكس.
// row يجب أن يحمل: id, foodics_order_id, foodics_delivery_status, delivered_at
// ترجع 'synced' | 'failed' | 'skipped' | 'rate_limited'
// ═══════════════════════════════════════════════════════════════════
type SyncRow = {
  id: string
  foodics_order_id: string | null
  foodics_delivery_status: number | null
  delivered_at: string | null
}

async function syncRowToFoodics(config: FoodicsConfig, row: SyncRow): Promise<string> {
  const target = row.foodics_delivery_status
  // لا نزامن إلا الحالتين الصادرتين منا (2=Ready، 5=Delivered)
  if (
    !row.foodics_order_id ||
    (target !== FOODICS_DELIVERY_STATUS.READY && target !== FOODICS_DELIVERY_STATUS.DELIVERED)
  ) {
    return 'skipped'
  }

  const base = (config.api_base_url || 'https://api.foodics.com/v5').replace(/\/$/, '')
  const url = `${base}${outboundPath(row.foodics_order_id)}`
  // للتسليم: نرسل وقت التسليم الحقيقي المخزّن (لا وقت إعادة المحاولة)
  const body = target === FOODICS_DELIVERY_STATUS.DELIVERED
    ? outboundBody('delivered', toFoodicsUtc(row.delivered_at))
    : outboundBody('ready')

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

    if (res.status === 429) {
      // حد المعدّل: لا نحرق محاولة — الـ sweeper القادم يعيد تلقائياً
      console.error('Foodics rate-limited (429) | order:', row.foodics_order_id)
      return 'rate_limited'
    }

    if (res.ok) {
      const { data: marked, error: markErr } = await supabase.rpc('fn_foodics_sync_mark_synced', {
        p_order_id: row.id,
        p_delivery_status: target,
      })
      if (markErr) {
        console.error('mark_synced error:', markErr)
        return 'failed'
      }
      if (!marked) {
        // الحراسة فشلت: الطلب تقدّم لحالة أحدث أثناء الـ PUT، أو مهمة أخرى
        // سبقتنا. لو العلم مرفوع والحالة المخزّنة تختلف عمّا أرسلناه للتو،
        // فقد نكون كتبنا فوق حالة أحدث في فوديكس → نعيد فتح المزامنة
        // ليصحّحها الـ sweeper خلال 30 ثانية (تقارب ذاتي مضمون).
        const { data: fresh } = await supabase
          .from('orders')
          .select('foodics_delivery_status, synced_to_foodics')
          .eq('id', row.id)
          .maybeSingle()
        if (fresh?.synced_to_foodics === true && Number(fresh.foodics_delivery_status) !== target) {
          await supabase
            .from('orders')
            .update({ synced_to_foodics: false, foodics_sync_next_at: new Date().toISOString() })
            .eq('id', row.id)
          console.log('Reopened sync after stale PUT | order:', row.id)
        }
      }
      return 'synced'
    }

    const permanent = PERMANENT_HTTP.has(res.status)
    console.error('Foodics PUT failed', res.status, permanent ? '(permanent)' : '(will retry)',
      '| url:', url, '|', await res.text())
    await supabase.rpc('fn_foodics_sync_fail', { p_order_id: row.id, p_permanent: permanent })
    return 'failed'
  } catch (e) {
    console.error('Foodics PUT exception:', row.foodics_order_id, e)
    await supabase.rpc('fn_foodics_sync_fail', { p_order_id: row.id, p_permanent: false })
    return 'failed'
  }
}

// جلب صف الطلب بأحدث حالة ثم مزامنته (المسار السريع بعد الـ RPC)
async function syncOrderById(orderId: string) {
  const { data: row } = await supabase
    .from('orders')
    .select('id, source, foodics_order_id, foodics_delivery_status, delivered_at, synced_to_foodics')
    .eq('id', orderId)
    .maybeSingle()
  if (!row || row.source !== 'foodics' || !row.foodics_order_id) return
  if (row.synced_to_foodics === true) return // مهمة أخرى/الصدى أنهاها بالفعل

  const config = await getConfig()
  if (!config?.access_token) {
    console.error('foodics_config missing access_token — sweeper will retry')
    await supabase.rpc('fn_foodics_sync_fail', { p_order_id: row.id, p_permanent: false })
    return
  }
  await syncRowToFoodics(config, row as SyncRow)
}

// مزامنة دفعة (سلة الحذف): على دفعات من 5 بالتوازي
async function syncManyByIds(orderIds: string[]) {
  if (orderIds.length === 0) return
  const config = await getConfig()
  if (!config?.access_token) {
    console.error('foodics_config missing access_token — sweeper will retry bulk')
    return // synced=false مضبوطة من الـ RPC — الـ sweeper يتولاها
  }

  const { data: rows } = await supabase
    .from('orders')
    .select('id, foodics_order_id, foodics_delivery_status, delivered_at, synced_to_foodics')
    .in('id', orderIds)
    .eq('synced_to_foodics', false)
  if (!rows || rows.length === 0) return

  const BATCH = 5
  for (let i = 0; i < rows.length; i += BATCH) {
    const results = await Promise.all(
      rows.slice(i, i + BATCH).map((r) => syncRowToFoodics(config, r as SyncRow)),
    )
    if (results.includes('rate_limited')) {
      console.error('Bulk sync stopped on rate limit — sweeper will resume')
      break
    }
  }
}

// الـ sweeper (action='resync'): كل الطلبات المعلقة المستحقة، الأقدم أولاً
async function runResync() {
  const { data: rows, error } = await supabase
    .from('orders')
    .select('id, foodics_order_id, foodics_delivery_status, delivered_at')
    .eq('synced_to_foodics', false)
    .eq('source', 'foodics')
    .not('foodics_order_id', 'is', null)
    .in('status', ['ready', 'completed'])
    .lt('foodics_sync_attempts', MAX_SYNC_ATTEMPTS)
    .lte('foodics_sync_next_at', new Date().toISOString())
    .order('foodics_sync_next_at', { ascending: true })
    .limit(RESYNC_BATCH)
  if (error) {
    console.error('resync select error:', error)
    return
  }
  if (!rows || rows.length === 0) return

  const config = await getConfig()
  if (!config?.access_token) {
    console.error('foodics_config missing access_token — resync aborted')
    return
  }

  console.log('Resync sweep:', rows.length, 'pending order(s)')
  let synced = 0
  for (const row of rows) {
    const result = await syncRowToFoodics(config, row as SyncRow)
    if (result === 'rate_limited') {
      console.error('Resync stopped on 429 — next sweep resumes in 30s')
      break
    }
    if (result === 'synced') synced++
  }
  console.log('Resync done:', synced, '/', rows.length, 'synced')
}

// ═══════════════════════════════════════════════════════════════════
// نقطة الدخول
// ═══════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  try {
    const { session_id, order_internal_id, action, branch_id, scope } = await req.json()

    // ── الـ sweeper (pg_cron) — سرّي، لا يمر عبر جلسات المستخدمين ──
    if (action === 'resync') {
      const secret = Deno.env.get('FOODICS_RESYNC_SECRET')
      if (!secret || req.headers.get('x-resync-secret') !== secret) {
        return json({ success: false, error: 'unauthorized' }, 401)
      }
      background(runResync())
      return json({ success: true, accepted: true }, 202)
    }

    // ── التحويل الجماعي (سلة الحذف): محلي أولاً ثم فوديكس في الخلفية ──
    if (action === 'bulk_delivered') {
      if (!session_id || !branch_id || !['preparing', 'ready', 'both'].includes(scope)) {
        return json({ success: false, error: 'بيانات غير صحيحة' }, 400)
      }
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_kitchen_bulk_deliver', {
        p_session_id: session_id,
        p_branch_id: branch_id,
        p_scope: scope,
        p_device_info: req.headers.get('user-agent') ?? 'kitchen',
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
      const foodicsIds = orders
        .filter((o) => o.source === 'foodics' && o.foodics_order_id)
        .map((o) => o.id)

      // الرد فوراً — مزامنة فوديكس بالكامل في الخلفية، والـ sweeper ضمانتها
      background(syncManyByIds(foodicsIds))
      return json({ success: true, count: rpcRes?.count ?? orders.length, foodics_queued: foodicsIds.length })
    }

    // ── الأكشن الفردي: جاهز / تم التسليم ──
    if (!session_id || !order_internal_id || !['ready', 'delivered'].includes(action)) {
      return json({ success: false, error: 'بيانات غير صحيحة' }, 400)
    }

    // 1) القاعدة أولاً (RPC مؤمّنة: جلسة + forward-only + scan_log + synced=false)
    //    فشلها = فشل العملية كلها — فوديكس لم تُلمس بعد، لا تضارب ممكن.
    const rpcName = action === 'ready' ? 'rpc_kitchen_mark_ready_synced' : 'rpc_kitchen_mark_delivered'
    const { data: rpcRes, error: rpcErr } = await supabase.rpc(rpcName, {
      p_session_id: session_id,
      p_order_internal_id: order_internal_id,
      p_device_info: req.headers.get('user-agent') ?? 'kitchen',
      p_synced: false, // مُتجاهَل منذ migration 032 — للتوافق فقط
    })
    if (rpcErr) {
      console.error('RPC error:', rpcErr)
      return json({ success: false, error: rpcErr.message }, 500)
    }
    if (rpcRes && rpcRes.success === false) {
      return json({ success: false, error: rpcRes.error }, 200)
    }

    // 2) الرد فوراً — 3) فوديكس في الخلفية (ترسل آخر حالة مخزّنة)
    background(syncOrderById(order_internal_id))
    return json({ success: true })
  } catch (err) {
    console.error('update-status error:', err)
    return json({ success: false, error: (err as Error).message }, 500)
  }
})
