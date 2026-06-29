// ═══════════════════════════════════════════════════════════════════
// هوية تطبيقات التوصيل (Delivery Apps Identity)
//
// كل تطبيق له: اسم عربي + لوجو + لون هوية (color) + لون نص مقروء (ink).
// - color: يُستخدم للإطار/الشريط الجانبي/خلفية صندوق اللوجو.
// - ink: نسخة داكنة مقروءة من اللون لاستخدامها كنص على خلفية بيضاء
//        (الأصفر مثلاً غير مقروء كنص، فله ink بني/كهرماني داكن).
//
// مصدر الألوان: docs / ملف "هوية_تطبيقات_التوصيل.pdf" + معاينة اللوجوهات الفعلية.
// ⚠️ كيتا وهنقرستيشن لونهما الرسمي أصفر متطابق تقريباً، لذلك كيتا تستخدم
//    الأخضر الموجود في لوجوها للتفريق البصري عن هنقرستيشن (بطلب العميل).
//
// 🔌 الكشف (resolveDeliveryApp): الطلب يأتي من فوديكس عبر وسيط Deliverect،
//    واسم التطبيق المتوقع داخل بيانات الطلب الخام. الدالة تبحث في عدة حقول
//    محتملة + channel_link، وتطابقها بالأسماء المعروفة. بعد اختبار طلب توصيل
//    حقيقي نؤكد الحقل الصحيح ونثبّته في candidates.
// ═══════════════════════════════════════════════════════════════════

import keetaLogo from '../assets/img/apps/keeta.png'
import hungerLogo from '../assets/img/apps/hungerstation.png'
import jahezLogo from '../assets/img/apps/jahez.png'
import chefzLogo from '../assets/img/apps/chefz.png'
import ninjaLogo from '../assets/img/apps/ninja.png'
import mrsoolLogo from '../assets/img/apps/mrsool.png'
import toyouLogo from '../assets/img/apps/toyou.png'

// color: لون الهوية | ink: نص داكن مقروء على أبيض | onColor: نص فوق لون الهوية (للبادج)
export const DELIVERY_APPS = {
  keeta:         { name: 'كيتا',      logo: keetaLogo,  color: '#1AA67D', ink: '#0E8F66', onColor: '#ffffff' },
  hungerstation: { name: 'هنقرستيشن', logo: hungerLogo, color: '#FFC400', ink: '#9C6400', onColor: '#3A2A00' },
  jahez:         { name: 'جاهز',      logo: jahezLogo,  color: '#E2231A', ink: '#C41E15', onColor: '#ffffff' },
  chefz:         { name: 'ذا شيفز',   logo: chefzLogo,  color: '#EF6B2F', ink: '#C9531F', onColor: '#ffffff' },
  ninja:         { name: 'نينجا',     logo: ninjaLogo,  color: '#00ABB9', ink: '#008794', onColor: '#ffffff' },
  mrsool:        { name: 'مرسول',     logo: mrsoolLogo, color: '#00A65A', ink: '#008A4A', onColor: '#ffffff' },
  toyou:         { name: 'تويو',      logo: toyouLogo,  color: '#013A6B', ink: '#013A6B', onColor: '#ffffff' },
}

// طلب بلا تطبيق معروف (مباشر / كاشير / نوع غير محدد) — هوية المشروع البنفسجية
export const DIRECT_APP = { key: 'direct', name: 'مباشر', logo: null, color: '#5830C5', ink: '#5830C5', onColor: '#ffffff' }

/** يحوّل لون hex إلى rgba بشفافية معيّنة — للتدرّجات وخلفيات الكروت */
export function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// الأسماء المحتملة لكل تطبيق (عربي/إنجليزي/شركة) لمطابقة بيانات الطلب
const ALIASES = {
  keeta:         ['keeta', 'كيتا', 'meituan'],
  hungerstation: ['hungerstation', 'hunger station', 'hunger', 'هنقرستيشن', 'هنجرستيشن'],
  jahez:         ['jahez', 'جاهز'],
  chefz:         ['chefz', 'the chefz', 'thechefz', 'ذا شيفز', 'شيفز'],
  ninja:         ['ninja', 'نينجا'],
  mrsool:        ['mrsool', 'marsool', 'مرسول'],
  toyou:         ['toyou', 'to you', 'to-you', 'تويو'],
}

// 🔑 أدق طريقة للكشف: كل تكامل في فوديكس له app_id فريد.
// طلبات الكاشير اليدوي = 8f9eb3f6-7987-4f66-aa8c-478c34d0c568 (نتجاهله).
// نملأ هذه الخريطة بقيم app_id الحقيقية لكل تطبيق فور وصول أول طلب توصيل عبر Deliverect.
// مثال: '<deliverect-keeta-app-id>': 'keeta'
const APP_ID_MAP = {
  // 'xxxxxxxx-xxxx-...': 'keeta',
}

// app_id الخاص بتطبيق الكاشير اليدوي (ليس تطبيق توصيل) — يُتجاهل في الكشف
const CASHIER_APP_ID = '8f9eb3f6-7987-4f66-aa8c-478c34d0c568'

/**
 * يحدد هوية التطبيق لطلب معيّن.
 * يبحث بالترتيب في: عمود صريح (مستقبلاً) → بيانات الطلب الخام من فوديكس → channel_link.
 * يعيد كائن الهوية { key, name, logo, color, ink }. الافتراضي DIRECT_APP.
 */
export function resolveDeliveryApp(order) {
  if (!order) return DIRECT_APP

  // (1) عمود صريح إن وُجد لاحقاً (مثل order.delivery_app = 'keeta')
  const explicit = order.delivery_app
  if (explicit && DELIVERY_APPS[explicit]) {
    return { key: explicit, ...DELIVERY_APPS[explicit] }
  }

  const raw = order.raw_qr_data?.foodics_order || {}

  // (2) أدق إشارة: app_id التكامل (لكل تطبيق توصيل app_id فريد عبر Deliverect)
  if (raw.app_id && APP_ID_MAP[raw.app_id]) {
    const key = APP_ID_MAP[raw.app_id]
    return { key, ...DELIVERY_APPS[key] }
  }
  // طلب كاشير يدوي صريح → مباشر (لا نطابق اسم العميل بالخطأ)
  const isCashier = raw.app_id === CASHIER_APP_ID

  // (3) تجميع كل النصوص المرشّحة من الطلب ومطابقتها بالأسماء المعروفة
  const candidates = [
    explicit,
    raw.meta?.channelLink,          // ✅ الأدق (مؤكّد من طلبات الإنتاج): "Jahez"/"Keeta"...
    raw.meta?.external_number,       // "Jahez: 547077316" — يحوي اسم التطبيق أيضاً
    raw.aggregator?.name,
    raw.aggregator?.reference,
    raw.delivery?.aggregator?.name,
    raw.delivery_company?.name,
    isCashier ? '' : raw.customer?.name, // Deliverect أحياناً يضع اسم المنصة هنا
    raw.reference,
    raw.reference_x,
    Array.isArray(raw.tags) ? raw.tags.map(t => t?.name).join(' ') : '',
    order.channel_link,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (candidates) {
    for (const [key, names] of Object.entries(ALIASES)) {
      if (names.some(n => candidates.includes(n))) {
        return { key, ...DELIVERY_APPS[key] }
      }
    }
  }

  return DIRECT_APP
}

/** هل الطلب من تطبيق توصيل؟ (له هوية تطبيق معروفة، أي ليس DIRECT/كاشير يدوي) */
export function isDeliveryAppOrder(order) {
  return resolveDeliveryApp(order).key !== 'direct'
}

/**
 * رقم الطلب المعروض. لطلبات تطبيقات التوصيل نأخذ الرقم الظاهر داخل التطبيق
 * نفسه (من فوديكس في `meta.external_number` بصيغة "AppName: NUMBER") ونعرض
 * **آخر 4 أرقام فقط من اليمين** (مثل 547077316 → 7316، و5094 → 5094).
 * نأخذ ما بعد ":" ثم أول سطر فقط (Keeta أحياناً تضيف رقم تتبّع طويل في سطر تالٍ).
 * إن لم يوجد (طلب غير-توصيل) → نرجع رقم فوديكس الداخلي order_id كاملاً.
 */
export function resolveDisplayNumber(order) {
  if (!order) return ''
  const ext = order.raw_qr_data?.foodics_order?.meta?.external_number
  if (typeof ext === 'string' && ext.includes(':')) {
    const afterColon = ext.split(':').slice(1).join(':').trim()
    const firstLine = afterColon.split('\n')[0].trim()
    if (firstLine) return firstLine.slice(-4) // آخر 4 أرقام من اليمين
  }
  return order.order_id
}
