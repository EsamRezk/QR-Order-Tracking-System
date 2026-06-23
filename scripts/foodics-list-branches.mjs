// ───────────────────────────────────────────────────────────────────
// foodics-list-branches.mjs
// يجلب فروع Foodics لمساعدتك على ملء foodics_branch_mapping.
//
// الاستخدام (Node 18+):
//   FOODICS_TOKEN=<access_token> node scripts/foodics-list-branches.mjs
//
// اختياري — للإنتاج بدل Sandbox:
//   FOODICS_TOKEN=<token> FOODICS_BASE=https://api.foodics.com/v5 node scripts/foodics-list-branches.mjs
//
// المخرجات: جدول بكل فرع (id, name, reference, receives_online_orders)
// + قالب SQL جاهز للصق في 018_seed_foodics_branch_mapping.sql.
// ───────────────────────────────────────────────────────────────────

const TOKEN = process.env.FOODICS_TOKEN || process.argv[2]
const BASE = process.env.FOODICS_BASE || 'https://api-sandbox.foodics.com/v5'

if (!TOKEN) {
  console.error('❌ مفقود: مرّر التوكن عبر FOODICS_TOKEN=... أو كأول وسيط.')
  process.exit(1)
}

async function main() {
  const url = `${BASE.replace(/\/$/, '')}/branches?include=tags`
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
  const branches = body?.data ?? []

  if (!branches.length) {
    console.log('⚠️ لا توجد فروع في هذا الحساب.')
    return
  }

  console.log(`\n✅ عدد الفروع: ${branches.length}\n`)
  console.table(
    branches.map((b) => ({
      id: b.id,
      name: b.name,
      reference: b.reference,
      receives_online_orders: b.receives_online_orders,
    }))
  )

  // قالب SQL — عدّل أكواد فروعنا (Erqaa-01 / Laban-02 / AlMalqa-03) حسب الحاجة
  console.log('\n── قالب SQL للصق في 018_seed_foodics_branch_mapping.sql ──\n')
  console.log('INSERT INTO foodics_branch_mapping (foodics_branch_id, branch_id)')
  branches.forEach((b, i) => {
    const prefix = i === 0 ? 'SELECT' : 'UNION ALL SELECT'
    console.log(
      `${prefix} '${b.id}', id FROM branches WHERE code = '<CODE_للفرع: ${b.name}>'`
    )
  })
  console.log(';')
}

main().catch((err) => {
  console.error('❌ خطأ:', err.message)
  process.exit(1)
})
