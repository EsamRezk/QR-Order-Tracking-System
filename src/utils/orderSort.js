// ═══════════════════════════════════════════════════════════════════
// ترتيب الطلبات بالأحدث: أحدث طلب أو أحدث تحديث على طلب = أول كرت.
// الصفحة RTL، فأول كرت في الشبكة يظهر على اليمين — أي تحديث ينزل يميناً.
// ═══════════════════════════════════════════════════════════════════

// كل أوقات دورة حياة الطلب — آخرها هو "آخر نشاط" على الطلب
const ACTIVITY_FIELDS = ['delivered_at', 'completed_at', 'ready_at', 'accepted_at', 'scanned_at', 'created_at']

/** وقت آخر نشاط على الطلب (ms) — دخول جديد / جاهز / تم التسليم */
export function lastActivityAt(order) {
  let latest = 0
  for (const field of ACTIVITY_FIELDS) {
    const t = order?.[field] ? Date.parse(order[field]) : NaN
    if (t > latest) latest = t
  }
  return latest
}

/**
 * يرتب قائمة بالأحدث أولاً (نسخة جديدة — لا يغيّر الأصل).
 * getOrder: لقوائم مغلّفة مثل { order, mode } — يرجع الطلب نفسه.
 */
export function sortByLatest(list, getOrder = (x) => x) {
  return [...list].sort((a, b) => lastActivityAt(getOrder(b)) - lastActivityAt(getOrder(a)))
}
