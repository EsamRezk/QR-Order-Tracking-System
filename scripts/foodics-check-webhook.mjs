// ───────────────────────────────────────────────────────────────────
// foodics-check-webhook.mjs
// يتأكد أن Foodics سجّلت رابط الـ webhook الخاص بنا على حدث order.created.
//
// الاستخدام (Node 18+):
//   FOODICS_TOKEN=<access_token> node scripts/foodics-check-webhook.mjs
//
// اختياري — للإنتاج بدل Sandbox:
//   FOODICS_TOKEN=<token> FOODICS_BASE=https://api.foodics.com/v5 node scripts/foodics-check-webhook.mjs
//
// المخرجات: جدول بكل webhook مسجّل (url + events + status)
// + تحقّق صريح: هل رابطنا موجود ومربوط بـ order.created؟
// ───────────────────────────────────────────────────────────────────

const TOKEN = process.env.FOODICS_TOKEN || process.argv[2]
const BASE = process.env.FOODICS_BASE || 'https://api-sandbox.foodics.com/v5'

// رابطنا المسجّل في Foodics (نفس القيمة في docs/FOODICS_HANDOFF.md)
const OUR_URL =
  process.env.OUR_WEBHOOK_URL ||
  'https://ucpudjjahbctzluseipo.supabase.co/functions/v1/test-foodics-webhook'
const TARGET_EVENT = 'order.created'

if (!TOKEN) {
  console.error('❌ مفقود: مرّر التوكن عبر FOODICS_TOKEN=... أو كأول وسيط.')
  process.exit(1)
}

async function main() {
  const url = `${BASE.replace(/\/$/, '')}/webhooks`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  })

  if (!res.ok) {
    console.error(`❌ فشل الطلب: HTTP ${res.status}`)
    console.error(await res.text())
    process.exit(1)
  }

  const body = await res.json()
  const hooks = body?.data ?? []

  if (!hooks.length) {
    console.log('\n⚠️ لا توجد أي webhooks مسجّلة على هذا الحساب إطلاقاً.')
    console.log('   → يلزم تسجيل رابطنا على حدث order.created.\n')
    process.exit(2)
  }

  console.log(`\n✅ عدد الـ webhooks المسجّلة: ${hooks.length}\n`)
  console.table(
    hooks.map((h) => ({
      id: h.id,
      url: h.url,
      // events قد تأتي كمصفوفة أو كنص — نطبّعها للعرض
      events: Array.isArray(h.events) ? h.events.join(', ') : h.events,
    }))
  )

  // التحقّق الصريح: رابطنا + الحدث المطلوب
  const normalize = (u) => (u || '').trim().replace(/\/$/, '').toLowerCase()
  const hasEvent = (h) => {
    const ev = h.events
    if (Array.isArray(ev)) return ev.includes(TARGET_EVENT)
    if (typeof ev === 'string') return ev.includes(TARGET_EVENT)
    return false
  }

  const ourHooks = hooks.filter((h) => normalize(h.url) === normalize(OUR_URL))
  const matched = ourHooks.find(hasEvent)

  console.log('\n── نتيجة التحقّق ──\n')
  if (matched) {
    console.log(`✅ تمام: رابطنا مسجّل ومربوط بحدث "${TARGET_EVENT}".`)
    console.log(`   id:  ${matched.id}`)
    console.log(`   url: ${matched.url}`)
    console.log('\n🎉 النظام جاهز للتشغيل — جرّب طلباً حقيقياً.')
    process.exit(0)
  }

  if (ourHooks.length) {
    console.log(
      `⚠️ رابطنا مسجّل لكنه غير مربوط بحدث "${TARGET_EVENT}".`
    )
    ourHooks.forEach((h) =>
      console.log(
        `   - id ${h.id}: events = ${
          Array.isArray(h.events) ? h.events.join(', ') : h.events
        }`
      )
    )
    console.log('\n   → اطلب من Foodics إضافة حدث order.created لهذا الرابط.')
    process.exit(3)
  }

  console.log(`❌ رابطنا غير موجود ضمن الـ webhooks المسجّلة:`)
  console.log(`   المتوقع: ${OUR_URL}`)
  console.log('\n   → يلزم تسجيل رابطنا على حدث order.created من إعدادات Foodics.')
  process.exit(4)
}

main().catch((err) => {
  console.error('❌ خطأ:', err.message)
  process.exit(1)
})
