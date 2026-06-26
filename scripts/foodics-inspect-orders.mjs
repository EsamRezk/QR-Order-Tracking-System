// ═══════════════════════════════════════════════════════════════════
// فحص مصدر الطلبات (تطبيق التوصيل) من بيانات فوديكس الخام
//
// الغرض: عند وصول طلب توصيل حقيقي عبر Deliverect، نشغّل هذا السكربت لنرى
// أين يضع فوديكس/Deliverect اسم التطبيق (app_id / source / customer / tags...)
// ثم نملأ APP_ID_MAP في src/config/deliveryApps.js.
//
// التشغيل:  node scripts/foodics-inspect-orders.mjs
// يقرأ VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY من .env (جدول orders RLS مفتوح للقراءة).
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'

function readEnv() {
  const env = {}
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) env[m[1].trim()] = m[2].trim().replace(/\r$/, '')
    }
  } catch {
    console.error('❌ لم يُعثر على ملف .env')
    process.exit(1)
  }
  return env
}

const env = readEnv()
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
if (!URL_ || !KEY) {
  console.error('❌ VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY غير موجود في .env')
  process.exit(1)
}

const CASHIER_APP_ID = '8f9eb3f6-7987-4f66-aa8c-478c34d0c568'

const res = await fetch(
  `${URL_}/rest/v1/orders?select=order_id,order_type,source,channel_link,created_at,raw_qr_data&order=created_at.desc&limit=40`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
)
if (!res.ok) {
  console.error('❌ فشل الطلب:', res.status, await res.text())
  process.exit(1)
}
const orders = await res.json()
console.log(`\n📦 عدد الطلبات: ${orders.length}\n`)

console.log('order  | type      | source | app_id (مختصر)      | كاشير؟ | customer        | tags')
console.log('-'.repeat(100))
for (const o of orders) {
  const f = o.raw_qr_data?.foodics_order || {}
  const appShort = f.app_id ? f.app_id.slice(0, 8) : '—'
  const isCashier = f.app_id === CASHIER_APP_ID ? 'نعم' : (f.app_id ? '🚩 لا' : '—')
  const tags = Array.isArray(f.tags) ? f.tags.map(t => t?.name).join(',') : ''
  console.log(
    `${String(o.order_id).padEnd(6)} | ${String(o.order_type).padEnd(9)} | ${String(f.source ?? '—').padEnd(6)} | ${appShort.padEnd(18)} | ${isCashier.padEnd(5)} | ${String(f.customer?.name ?? '—').slice(0, 15).padEnd(15)} | ${tags}`,
  )
}

// أبرز أي طلب app_id فيه يختلف عن الكاشير = مرشّح لطلب تطبيق توصيل حقيقي
const candidates = orders.filter(o => {
  const id = o.raw_qr_data?.foodics_order?.app_id
  return id && id !== CASHIER_APP_ID
})
console.log('\n' + '='.repeat(100))
if (candidates.length === 0) {
  console.log('🟡 كل الطلبات من تطبيق الكاشير اليدوي — لا يوجد طلب تطبيق توصيل حقيقي بعد.')
} else {
  console.log(`🟢 ${candidates.length} طلب بمصدر مختلف عن الكاشير (مرشّح لتطبيق توصيل):`)
  for (const o of candidates) {
    const f = o.raw_qr_data.foodics_order
    console.log(`\n— طلب #${o.order_id}: app_id=${f.app_id} | source=${f.source} | customer=${f.customer?.name}`)
    console.log('  raw_qr_data كامل:')
    console.log(JSON.stringify(f, null, 2).split('\n').map(l => '  ' + l).join('\n'))
  }
}
