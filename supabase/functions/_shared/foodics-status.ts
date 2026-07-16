// ═══════════════════════════════════════════════════════════════════
// 🔑 المصدر الوحيد لكل افتراضات حالات فوديكس (Single Source of Truth)
//
// ✅ أُكّدت قيم delivery_status بالكامل من فوديكس (اجتماع + إيميل 2026-06-29):
//      1=Sent to kitchen  2=Ready  3=Assigned  4=Enroute  5=Delivered  6=Cancelled
//      كما أُكّد base URL (api.foodics.com/v5) و scope الكتابة (orders.limited.deliver)
//      والأحداث المشتركة (orders.created / orders.updated).
//
// ما زال غير مؤكّد رسمياً ومتعلّم بـ // ❓ CONFIRM: أرقام order.type، وأرقام
//      order.status للإلغاء، وصيغة جسم الـ PUT الصادر (الحقول/التوقيت).
// عند تأكيد أيٍّ منها: عدّل هنا فقط ثم أعد نشر الـ Edge Functions — لا مكان آخر.
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
//    ✅ مؤكّد (إيميل فوديكس 2026-06-29): المشترك على الإنتاج orders.created +
//       orders.updated (يحملان الطلب كاملاً مع delivery_status). والطلبات تصل فعلياً.
//       نُبقي صيغ المفرد + أحداث delivery.* القديمة دفاعياً دون ضرر.
// ───────────────────────────────────────────────────────────────────
export const HANDLED_EVENTS = new Set<string>([
  'order.delivery.created',
  'order.delivery.updated',
  // مقبولة دفاعياً طالما الـ payload يحمل delivery_status:
  'order.created',
  'order.updated',
  // صيغ الجمع (حسب إيميل فوديكس 2026-06-29: المشترك orders.created/orders.updated):
  'orders.created',
  'orders.updated',
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
//    فوديكس → الحالة المحلية.
//
//    ✅ مؤكّد بالكامل من فوديكس (جدول delivery_status — اجتماع + إيميل 2026-06-29):
//       1 = Sent to kitchen  (بعد قبول الطلب وإرساله للتحضير)
//       2 = Ready            (عند bump الطلب من المطبخ)
//       3 = Assigned         (DMS يُسند مندوباً)        ← نتجاهله
//       4 = Enroute          (DMS أرسل المندوب)         ← نتجاهله
//       5 = Delivered        (المندوب سلّم الطلب)
//       6 = Cancelled        (DMS ألغى الطلب)
// ───────────────────────────────────────────────────────────────────
export const FOODICS_DELIVERY_STATUS = {
  SENT_TO_KITCHEN: 1, // ✅ → نُنشئ الطلب محلياً كـ 'preparing'
  READY:           2, // ✅ → 'ready'
  DELIVERED:       5, // ✅ → 'completed'
  CANCELLED:       6, // ✅ → 'cancelled'
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
//    ✅ مؤكّد من توثيق فوديكس الرسمي (Delivery Management Integration):
//       - الـ endpoint: PUT {base_url}/orders/{order_id}
//       - الحقول القابلة للتحديث (فردياً): delivery_status (1..6) + توقيتات UTC
//         بصيغة "YYYY-MM-DD HH:MM:SS": driver_assigned_at / dispatched_at /
//         driver_collected_at / delivered_at + driver_id.
//       - scope: orders.limited.deliver.
//    ⚠️ خطأ 404 على الـ PUT لا يعني الـ endpoint غلط — يعني الأوردر غير موجود
//       بالتوكن/البيئة المستخدمة (تحقّق أن foodics_config: التوكن إنتاج + api_base_url
//       = https://api.foodics.com/v5 وليس Sandbox).
// ───────────────────────────────────────────────────────────────────

// توقيت UTC بصيغة فوديكس: "YYYY-MM-DD HH:MM:SS"  ✅ (مؤكّد من التوثيق)
export function foodicsUtcNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

// تحويل timestamptz (ISO من القاعدة) إلى صيغة فوديكس — يُستخدم في إعادة المزامنة
// المتأخرة (resync) كي يصل فوديكس وقتُ التسليم الحقيقي لا وقتُ إعادة المحاولة.
export function toFoodicsUtc(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export type OutboundAction = 'ready' | 'delivered'

// جسم طلب الـ PUT المرسل لفوديكس لكل زر.
// deliveredAtUtc (اختياري): وقت تسليم مخزّن بصيغة فوديكس — للـ resync المتأخر.
export function outboundBody(action: OutboundAction, deliveredAtUtc?: string): Record<string, unknown> {
  if (action === 'ready') {
    return { delivery_status: FOODICS_DELIVERY_STATUS.READY } // ✅ 2 (Ready)
  }
  // delivered (5) → التوقيت الصحيح للتسليم للعميل هو delivered_at (حسب التوثيق)
  return {
    delivery_status: FOODICS_DELIVERY_STATUS.DELIVERED, // ✅ 5 (Delivered)
    delivered_at: deliveredAtUtc ?? foodicsUtcNow(),    // ✅ حقل التسليم
  }
}

// مسار تحديث الطلب على فوديكس (نسبةً لـ api_base_url).  ✅ PUT /orders/{id}
export function outboundPath(foodicsOrderId: string): string {
  return `/orders/${encodeURIComponent(foodicsOrderId)}`
}
