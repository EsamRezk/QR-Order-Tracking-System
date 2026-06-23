# test-foodics-webhook — تعليمات النشر

Endpoint يستقبل webhook فوديكس عند `order.created`، يجلب الطلب الكامل عبر
`GET /orders/{id}`، ثم ينشئ الطلب محلياً بحالة `new`.

> **مهم:** فوديكس يرسل في الـ webhook **معرّف الطلب فقط** (`entity.id`) وليس تفاصيله،
> ولا يرسل توقيعاً (signature). لذلك نجلب التفاصيل بأنفسنا بالـ access_token — وهذا
> هو نموذج الأمان (أي معرّف مزيّف يُرجع 404 فيُتجاهَل).

## قبل النشر — شغّل الـ migrations على Supabase (بالترتيب)
في Supabase SQL Editor:
1. `014_foodics_orders_flow.sql`
2. `015_foodics_config_and_mapping.sql`
3. `016_scan_logs_types.sql`
4. `017_rpc_kitchen_flow.sql`

## النشر
```bash
supabase functions deploy test-foodics-webhook --no-verify-jwt
```
الرابط الناتج (سجّله في Foodics مع حدث `order.created`):
```
https://ucpudjjahbctzluseipo.supabase.co/functions/v1/test-foodics-webhook
```
`SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` متاحان تلقائياً داخل الـ Edge Function.

## ما يجب إكماله بعد وصول بيانات Foodics
1. خزّن التوكن (Sandbox افتراضياً عبر `api_base_url`):
   ```sql
   INSERT INTO foodics_config (business_id, access_token)
   VALUES ('922240', '<ACCESS_TOKEN>');
   -- للإنتاج لاحقاً: UPDATE foodics_config SET api_base_url='https://api.foodics.com/v5';
   ```
2. اجلب الـ branch IDs:
   ```bash
   FOODICS_TOKEN=<ACCESS_TOKEN> node scripts/foodics-list-branches.mjs
   ```
   ثم املأ وشغّل `018_seed_foodics_branch_mapping.sql`.
3. سجّل الـ webhook في فوديكس (من إعدادات التطبيق أو عبر support@foodics.com)
   على الرابط أعلاه مع حدث `order.created`.

> لم تعد هناك حاجة لـ `verifySignature()` ولا لتأكيد أسماء حقول الـ payload —
> الطلب يُجلب كاملاً من API فوديكس.

## اختبار سريع
يحتاج: التوكن مخزّناً + الربط مُعدّاً + معرّف طلب حقيقي موجود في حساب فوديكس.
```bash
curl -X POST https://ucpudjjahbctzluseipo.supabase.co/functions/v1/test-foodics-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"order.created","entity":{"type":"order","id":"<REAL_FOODICS_ORDER_ID>"}}'
# متوقع: {"status":"created","order_id":"..."}
# لو المعرّف غير حقيقي: {"status":"fetch_failed","http_status":404,...}
```
