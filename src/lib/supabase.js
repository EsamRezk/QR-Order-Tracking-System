import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * يجلب كل الصفوف على دفعات (صفحات) لتجاوز حد Supabase الافتراضي (Max rows = 1000 صف).
 * كل طلب يجلب صفحة بحجم `pageSize` عبر .range() ثم يكرّر حتى تنتهي الصفوف،
 * فلا يوجد سقف عملي لعدد الطلبات المُعادة.
 *
 * @param {() => import('@supabase/supabase-js').PostgrestFilterBuilder} buildQuery
 *   دالة تُنشئ الاستعلام الأساسي (select + الفلاتر + order) من جديد في كل نداء —
 *   لازم دالة وليست كائن الاستعلام نفسه، لأن الـ builder لا يُعاد استخدامه بعد await.
 * @param {number} pageSize حجم الصفحة (افتراضي 100).
 * @returns {Promise<any[]>} كل الصفوف مجمّعة.
 */
export async function fetchAllPaged(buildQuery, pageSize = 100) {
  const all = []
  let from = 0
  // حماية من حلقة لا نهائية في حال خطأ غير متوقع
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) {
      console.error('fetchAllPaged error:', error)
      break
    }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break // آخر صفحة
    from += pageSize
  }
  return all
}
