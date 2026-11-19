// ═══════════════════════════════════════════════════════════════════
// تنبيهات الموبايل (Web Push) — مشتركة بين foodics-webhook و push-test
//
// المفاتيح (VAPID) تُقرأ من جدول push_config (service_role فقط — migration 035).
// الاشتراكات في push_subscriptions مربوطة بالفرع. الاشتراك المنتهي (404/410
// من خدمة الإشعارات) يُحذف تلقائياً.
// ═══════════════════════════════════════════════════════════════════

import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string }

// أسماء تطبيقات التوصيل (نفس مفاتيح orders.delivery_app — migration 027)
const DELIVERY_APP_NAMES: Record<string, string> = {
  keeta: 'كيتا',
  hungerstation: 'هنقرستيشن',
  jahez: 'جاهز',
  chefz: 'ذا شفز',
  ninja: 'نينجا',
  mrsool: 'مرسول',
  toyou: 'تويو',
  direct: 'مباشر',
}

export function deliveryAppName(key: string | null | undefined): string | null {
  if (!key) return null
  return DELIVERY_APP_NAMES[key] ?? null
}

let vapidReady: Promise<boolean> | null = null

function ensureVapid(supabase: SupabaseClient): Promise<boolean> {
  if (!vapidReady) {
    vapidReady = (async () => {
      const { data, error } = await supabase
        .from('push_config')
        .select('vapid_public_key, vapid_private_key, subject')
        .eq('id', 1)
        .maybeSingle()
      if (error || !data) {
        console.error('push_config missing', error)
        vapidReady = null // نعيد المحاولة في النداء التالي
        return false
      }
      webpush.setVapidDetails(data.subject, data.vapid_public_key, data.vapid_private_key)
      return true
    })()
  }
  return vapidReady
}

export async function sendToSubscriptions(
  supabase: SupabaseClient,
  subs: Subscription[],
  payload: PushPayload,
) {
  if (!subs.length) return { sent: 0, failed: 0, removed: 0 }
  if (!(await ensureVapid(supabase))) return { sent: 0, failed: subs.length, removed: 0, error: 'no_vapid' }

  const body = JSON.stringify(payload)
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 600, urgency: 'high' },
      ),
    ),
  )

  const gone: string[] = []
  let failed = 0
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') return
    const code = (r.reason as { statusCode?: number })?.statusCode
    if (code === 404 || code === 410) {
      gone.push(subs[i].id) // الجهاز ألغى الاشتراك أو انتهى
    } else {
      failed += 1
      console.error('push send failed', code ?? '-', (r.reason as Error)?.message ?? r.reason)
    }
  })

  if (gone.length) {
    await supabase.from('push_subscriptions').delete().in('id', gone)
  }
  return { sent: results.length - gone.length - failed, failed, removed: gone.length }
}

// تنبيه كل أجهزة فرع معيّن (يُستدعى من foodics-webhook عند إنشاء طلب جديد)
export async function notifyBranch(supabase: SupabaseClient, branchId: string, payload: PushPayload) {
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('branch_id', branchId)
  if (error) {
    console.error('push_subscriptions read failed', error)
    return { sent: 0, failed: 0, removed: 0 }
  }
  return sendToSubscriptions(supabase, (subs ?? []) as Subscription[], payload)
}
