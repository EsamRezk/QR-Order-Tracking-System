// ═══════════════════════════════════════════════════════════════════
// Edge Function: test-foodics-webhook  (alias — مهجور/للتوافق فقط)
//
// هذا الاسم كان مسجّلاً على مشروع Supabase القديم (Sandbox). للحفاظ على عمل أي
// رابط مسجَّل سابقاً بنفس المنطق الجديد، هذه الدالة مجرد alias يعيد تصدير المنطق
// الرسمي من foodics-webhook (مصدر واحد للحقيقة — بلا تكرار).
//
// القناة الرسمية الجديدة للـ inbound هي: foodics-webhook
//   https://<PROJECT_REF>.supabase.co/functions/v1/foodics-webhook
//
// النشر (إن لزم إبقاء هذا الرابط):
//   npx supabase functions deploy test-foodics-webhook --no-verify-jwt
// ═══════════════════════════════════════════════════════════════════

import '../foodics-webhook/index.ts'
