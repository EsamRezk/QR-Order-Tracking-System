// ═══════════════════════════════════════════════════════════════════
// Edge Function: push-test  — تنبيه تجريبي لجهاز المستخدم الحالي
//
// تُستدعى من زر "إرسال تنبيه تجريبي" في نافذة التنبيهات بشاشة الفرع، لتتأكد
// أن السلسلة كاملة تعمل على هذا الموبايل (اشتراك → خادم → خدمة الإشعارات → الجهاز).
//
// الجسم: { session_id, endpoint }
// الأمان: الجلسة لازم تكون صالحة (get_session_user)، والاشتراك لازم يخص نفس
// المستخدم (أو المستخدم مدير). لا يمكن إرسال تنبيه لجهاز شخص آخر.
//
// النشر: verify_jwt=false (التحقق بالجلسة كباقي دوال المشروع)
// ═══════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendToSubscriptions } from '../_shared/push.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405)

  let body: { session_id?: string; endpoint?: string }
  try {
    body = await req.json()
  } catch {
    return json({ success: false, error: 'invalid_json' }, 400)
  }
  if (!body.session_id || !body.endpoint) {
    return json({ success: false, error: 'بيانات ناقصة' }, 400)
  }

  const { data: users, error: sessErr } = await supabase.rpc('get_session_user', {
    p_session_id: body.session_id,
  })
  const user = Array.isArray(users) ? users[0] : users
  if (sessErr || !user) return json({ success: false, error: 'غير مصرح' })

  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, user_id, branch_id, branches(name_ar, code)')
    .eq('endpoint', body.endpoint)
    .maybeSingle()
  if (!sub) return json({ success: false, error: 'الجهاز غير مسجّل للتنبيهات' })
  if (sub.user_id !== user.user_id && user.role !== 'admin') {
    return json({ success: false, error: 'غير مصرح' })
  }

  const branch = (sub as { branches?: { name_ar?: string; code?: string } }).branches
  const result = await sendToSubscriptions(supabase, [sub], {
    title: 'تنبيه تجريبي ✅',
    body: `التنبيهات شغالة على هذا الجهاز${branch?.name_ar ? ` — فرع ${branch.name_ar}` : ''}`,
    url: branch?.code ? `/kitchen?branch=${branch.code}` : '/',
    tag: 'kz-test',
  })
  console.log('push-test', user.user_id, JSON.stringify(result))

  if (result.sent === 1) return json({ success: true })
  if (result.removed === 1) return json({ success: false, error: 'انتهى اشتراك الجهاز — فعّل التنبيهات مرة أخرى' })
  return json({ success: false, error: 'تعذّر إرسال التنبيه' })
})
