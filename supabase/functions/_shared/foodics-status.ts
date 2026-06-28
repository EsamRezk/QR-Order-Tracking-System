// ═══════════════════════════════════════════════════════════════════
// 🔑 المصدر الوحيد لكل افتراضات حالات فوديكس (Single Source of Truth)
//
// ⚠️⚠️ كل القيم هنا "مفترضة" من ملف KebbaZone_Foodics_Integration_Flow ولم
//      تُؤكَّد بعد من فوديكس. بعد الاجتماع/أول طلب حقيقي، عدّل القيم في هذا
//      الملف وحده ثم أعد نشر الـ Edge Functions — لا تعدّل أي مكان آخر.
//
// كل بند ناقص متعلّم بـ:  // ❓ CONFIRM
//
// الدالتان (inbound + outbound) تستوردان من هنا:
//   - foodics-webhook/index.ts        (القراءة: فوديكس → عندنا)
//   - foodics-update-status/index.ts  (الكتابة: عندنا → فوديكس)
// ═══════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────
// 1) order.type  →  التسمية الداخلية
//    ❓ CONFIRM: تأكيد أرقام الأنواع (خاصة 4 = drive_thru؟)
// ───────────────────────────────────────────────────────────────────
export const ORDER_TYPES: Record<number, string> = {
  1: 'dine_in',
  2: 'pickup',
  3: 'delivery',
  4: 'drive_thru',
}

// ───────────────────────────────────────────────────────────────────
// 2) أحداث الـ webhook التي نسجّلها/نعالجها عند فوديكس
//    ❓ CONFIRM: الأسماء الدقيقة للأحداث التي تُطلق عند:
//       - إرسال الطلب للمطبخ
//       - تغيّر حالة التوصيل (ready / delivered)
// ───────────────────────────────────────────────────────────────────
export const HANDLED_EVENTS = new Set<string>([
  'order.delivery.created',
  'order.delivery.updated',
  // مقبولة دفاعياً طالما الـ payload يحمل delivery_status:
  'order.created',
  'order.updated',
])

// ───────────────────────────────────────────────────────────────────
// 3) order.status (دورة حياة الطلب نفسه 1..8)
//    نستخدمه فقط لكشف الإلغاء/الإبطال.
//    ❓ CONFIRM: أي أرقام status تعني "ملغي" فعلياً؟ (المفترض 3=Declined, 7=Void)
// ───────────────────────────────────────────────────────────────────
export const FOODICS_ORDER_STATUS = {
  DECLINED: 3, // ❓ CONFIRM
  VOID: 7,     // ❓ CONFIRM
}
export function isCancelledOrderStatus(orderStatus: number): boolean {
  return orderStatus === FOODICS_ORDER_STATUS.DECLINED ||
         orderStatus === FOODICS_ORDER_STATUS.VOID
}

// ───────────────────────────────────────────────────────────────────
// 4) delivery_status  ← القلب: مزامنة القراءة (inbound)
//    فوديكس → الحالة المحلية. هذه أهم قيم نحتاج تأكيدها.
//
//    ❓ CONFIRM (الأهم في الاجتماع): القيمة الرقمية الدقيقة لكل مرحلة:
//       SENT_TO_KITCHEN  (الكاشير ضغط "إرسال للمطبخ")     المفترض = 1
//       READY            (جاهز)                            المفترض = 2
//       DELIVERED        (تم التسليم للمندوب/العميل)        المفترض = 5
//       CANCELLED        (ألغي من نظام التوصيل DMS)         المفترض = 6
//    والقيم الوسيطة (assigned/enroute) التي نتجاهلها (تتولاها فوديكس).
// ───────────────────────────────────────────────────────────────────
export const FOODICS_DELIVERY_STATUS = {
  SENT_TO_KITCHEN: 1, // ❓ CONFIRM  → نُنشئ الطلب محلياً كـ 'preparing'
  READY:           2, // ❓ CONFIRM  → 'ready'
  DELIVERED:       5, // ❓ CONFIRM  → 'completed'
  CANCELLED:       6, // ❓ CONFIRM  → 'cancelled'
}

// خريطة inbound: delivery_status رقمي → الحالة المحلية المستهدفة.
// أي قيمة غير مذكورة (assigned/enroute/null) = لا تغيير (تتجاهلها الدالة).
export function deliveryStatusToLocal(deliveryStatus: number | null): string | null {
  if (deliveryStatus === null) return null
  switch (deliveryStatus) {
    case FOODICS_DELIVERY_STATUS.SENT_TO_KITCHEN: return 'preparing'
    case FOODICS_DELIVERY_STATUS.READY:           return 'ready'
    case FOODICS_DELIVERY_STATUS.CANCELLED:       return 'cancelled'
    case FOODICS_DELIVERY_STATUS.DELIVERED:       return 'completed'
    default:
      // قيم تسليم ≥ DELIVERED غير المذكورة نعتبرها اكتمالاً (دفاعي)
      if (deliveryStatus >= FOODICS_DELIVERY_STATUS.DELIVERED) return 'completed'
      return null
  }
}

// ترتيب الحالات لمنع التراجع (forward-only) — لا يحتاج تأكيد.
export const STATUS_RANK: Record<string, number> = {
  new: 0,
  preparing: 1,
  ready: 2,
  completed: 3,
  cancelled: 3,
}

// ───────────────────────────────────────────────────────────────────
// 5) الكتابة (outbound): عندنا → فوديكس. ماذا نرسل عند كل زر؟
//
//    ❓ CONFIRM (مهم في الاجتماع):
//       - الـ endpoint الصحيح لتحديث حالة التوصيل (PUT /orders/{id}؟ أم
//         endpoint خاص بالتوصيل مثل /orders/{id}/delivery؟)
//       - اسم الحقل وقيمته عند "جاهز"  (المفترض delivery_status = 2)
//       - اسم الحقل وقيمته عند "تم التسليم" (المفترض delivery_status = 5
//         + driver_collected_at بصيغة UTC؟ أم حقل آخر؟)
//       - الـ scope المطلوب على التوكن لتنفيذ هذه الكتابة
//         (المفترض orders.limited.deliver)
// ───────────────────────────────────────────────────────────────────

// توقيت UTC بصيغة فوديكس: "YYYY-MM-DD HH:MM:SS"  ❓ CONFIRM الصيغة المطلوبة
export function foodicsUtcNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export type OutboundAction = 'ready' | 'delivered'

// جسم طلب الـ PUT المرسل لفوديكس لكل زر.
export function outboundBody(action: OutboundAction): Record<string, unknown> {
  if (action === 'ready') {
    return { delivery_status: FOODICS_DELIVERY_STATUS.READY } // ❓ CONFIRM
  }
  // delivered
  return {
    delivery_status: FOODICS_DELIVERY_STATUS.DELIVERED,        // ❓ CONFIRM
    driver_collected_at: foodicsUtcNow(),                      // ❓ CONFIRM (الحقل/الصيغة)
  }
}

// مسار تحديث الطلب على فوديكس (نسبةً لـ api_base_url).  ❓ CONFIRM
export function outboundPath(foodicsOrderId: string): string {
  return `/orders/${encodeURIComponent(foodicsOrderId)}`
}
