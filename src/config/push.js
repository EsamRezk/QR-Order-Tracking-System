// المفتاح العام لتنبيهات الموبايل (VAPID public key) — عام بطبيعته وآمن في الكود.
// نصفه الخاص في جدول push_config بقاعدة البيانات (service_role فقط — migration 035).
// ⚠️ لو تغيّر زوج المفاتيح يجب تحديث الاثنين معاً، وكل الأجهزة تحتاج تفعيل من جديد.
export const VAPID_PUBLIC_KEY =
  'BFS43S8Ie3vC3zOZb03tuTXTQPTRJOZhrTKeFb2Pr9A8u3a4vISqLl-sWnrFUgSbRnevvmwWKHSsqzzXhtYKRI0'
