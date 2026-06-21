# خطة تكامل Foodics + تدفق "الاستلام" — QR Order Tracking System

> **التاريخ:** 2026-06-21
> **الحالة:** جاهزة للتنفيذ بمجرد استلام بيانات Foodics
> **يحلّ محل (يوسّع):** `2026-03-24-foodics-integration-design.md` + `2026-03-24-foodics-integration-plan.md`
> **الفرق الجوهري عن الخطة القديمة:** إضافة خطوة **"استلام الطلب"** في المطبخ → وهذا يتطلب حالة طلب جديدة `new` قبل `preparing`.

---

## 1. الهدف

ربط النظام مع Foodics بحيث تدخل الطلبات تلقائياً عبر **webhook** بدل المسح، مع تدفق تشغيلي جديد:

```
Foodics POS (طلب جديد)
   ↓ webhook: order.created
Supabase Edge Function (/foodics-webhook)
   ↓ INSERT order (status = 'new', source = 'foodics')
   ↓ Realtime
شاشة المطبخ → الطلب يظهر في قسم "طلبات جديدة" مع زر "استلام"
   ↓ موظف يضغط "استلام"  →  status = 'preparing'
شاشة العميل (Display) → الطلب يظهر "قيد التجهيز"
شاشة المطبخ → نفس الطلب الآن يظهر زر "جاهز"
   ↓ موظف يضغط "جاهز"  →  status = 'ready'
شاشة العميل → الطلب ينتقل لقائمة "جاهز للاستلام"
   ↓ تلقائي بعد VITE_READY_TIMEOUT_MINUTES
status = 'completed'
```

---

## 2. دورة حياة الطلب — قديم مقابل جديد

| المرحلة | الحالي (QR) | الجديد (Foodics) |
|---------|-------------|------------------|
| إنشاء الطلب | مسح QR أول → `preparing` | webhook → `new` |
| بداية التجهيز | فوري عند الإنشاء | الموظف يضغط "استلام" → `preparing` |
| جاهز | مسح QR ثاني / زر مطبخ → `ready` | زر "جاهز" بالمطبخ → `ready` |
| مكتمل | تلقائي بعد مهلة | تلقائي بعد مهلة (بدون تغيير) |

**ملاحظة عن حساب مدة التحضير:** حالياً `prep_duration_seconds = ready_at - scanned_at` (عمود GENERATED). في التدفق الجديد، `scanned_at` لن يعكس بداية التجهيز الفعلية لأن الطلب يدخل كـ `new`. **الحل:** عند الضغط على "استلام" نضبط `scanned_at = now()` (لحظة بدء التجهيز) — وبذلك تبقى مدة التحضير = من الاستلام حتى الجاهزية، وهو الرقم الأصح تشغيلياً. (ونضيف `accepted_at` للتوثيق.)

---

## 3. ما نحتاجه من Foodics قبل التنفيذ (نقطة التوقف الوحيدة)

> ⚠️ كل شيء أدناه جاهز للبرمجة فوراً. الوحيد الناقص هو بيانات Foodics التالية:

| # | المطلوب | لماذا | المصدر |
|---|---------|-------|--------|
| 1 | `access_token` (أو `client_id` + `client_secret` لعمل OAuth) | لاستدعاء API (جلب الفروع، التحقق من الطلبات) | [scopes](https://apidocs.foodics.com/core/scopes.html) |
| 2 | الـ **Scopes** المفعّلة على التطبيق | لازم على الأقل: `general.read` (الفروع) + `orders.read` / `orders.limited.read` | scopes docs |
| 3 | **Webhook secret / آلية التوقيع** + عيّنة من رؤوس الطلب (headers) | للتحقق أن الـ webhook فعلاً من Foodics | [webhooks](https://apidocs.foodics.com/core/webhooks.html) |
| 4 | **عيّنة JSON حقيقية** لحدث `order.created` | لتثبيت أسماء الحقول بدقة (`id`, `number`, `branch.id`, `type`, ...) | webhooks docs |
| 5 | **Foodics branch IDs** للفروع الثلاثة | لربطها بفروعنا في `foodics_branch_mapping` | `GET /branches` |
| 6 | تأكيد أن `order.created` يُطلَق لكل المصادر (أونلاين + كاشير) | حتى لا تضيع طلبات الكاشير | introduction docs |

**بمجرد وصول البنود 1-6 → نُنفّذ المهام 1→9 أدناه بالترتيب.**

### مرجع Foodics سريع
- Base URL (Production): `https://api.foodics.com/v5`
- Auth: `Authorization: Bearer <ACCESS_TOKEN>`
- Webhook timeout: **5 ثوانٍ** — لازم نرد فوراً (نرد `200 OK` دائماً حتى عند الخطأ الداخلي).
- بعد 100+ فشل/دقيقة يتم حظر الـ endpoint لمدة ساعة.
- Order Types: `1=Dine In, 2=Pickup, 3=Delivery`.

---

## 4. تغييرات قاعدة البيانات

### المهمة 1 — توسيع حالة `orders` + أعمدة Foodics
ملف: `supabase/migrations/014_foodics_orders_flow.sql`

```sql
-- 1) إضافة حالة 'new' لقيد CHECK
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new', 'preparing', 'ready', 'completed'));

-- 2) أعمدة Foodics + الاستلام
ALTER TABLE orders ADD COLUMN source        TEXT DEFAULT 'qr';     -- 'foodics' | 'qr'
ALTER TABLE orders ADD COLUMN foodics_order_id      TEXT;          -- UUID من Foodics
ALTER TABLE orders ADD COLUMN foodics_order_number  TEXT;          -- الرقم المعروض
ALTER TABLE orders ADD COLUMN order_type    TEXT;                  -- dine_in | pickup | delivery
ALTER TABLE orders ADD COLUMN accepted_at   TIMESTAMPTZ;           -- لحظة "استلام" الطلب
ALTER TABLE orders ADD COLUMN accepted_by   TEXT;                  -- user_id الذي استلم

-- 3) منع تكرار طلب Foodics
CREATE UNIQUE INDEX idx_orders_foodics_order_id
  ON orders(foodics_order_id) WHERE foodics_order_id IS NOT NULL;
```

> ملاحظة: `scanned_at` له DEFAULT now()؛ في طلبات Foodics سنعيد ضبطه عند الاستلام (المهمة 5) ليبقى `prep_duration_seconds` صحيحاً.

### المهمة 2 — جداول إعداد Foodics
ملف: `supabase/migrations/015_foodics_config_and_mapping.sql`

```sql
CREATE TABLE foodics_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    TEXT,
  access_token   TEXT NOT NULL,
  webhook_secret TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE foodics_config ENABLE ROW LEVEL SECURITY; -- وصول عبر service_role فقط

CREATE TABLE foodics_branch_mapping (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foodics_branch_id TEXT UNIQUE NOT NULL,
  branch_id         UUID NOT NULL REFERENCES branches(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE foodics_branch_mapping ENABLE ROW LEVEL SECURITY;
```

### المهمة 3 — توسيع `scan_logs.scan_type`
ملف: `supabase/migrations/016_scan_logs_types.sql`

```sql
ALTER TABLE scan_logs DROP CONSTRAINT scan_logs_scan_type_check;
ALTER TABLE scan_logs ADD CONSTRAINT scan_logs_scan_type_check
  CHECK (scan_type IN ('first_scan', 'second_scan', 'accept', 'ready_scan'));
```

### المهمة 4 — RPC للاستلام والجاهزية
ملف: `supabase/migrations/017_rpc_kitchen_flow.sql`

```sql
-- استلام طلب: new → preparing
CREATE OR REPLACE FUNCTION rpc_kitchen_accept_order(
  p_session_id UUID, p_order_internal_id UUID, p_device_info TEXT
) RETURNS JSON AS $$
DECLARE v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role NOT IN ('admin','user') THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  UPDATE orders
  SET status = 'preparing', accepted_at = now(), scanned_at = now(),
      accepted_by = v_user.user_id::TEXT
  WHERE id = p_order_internal_id AND status = 'new';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الطلب غير متاح للاستلام');
  END IF;

  INSERT INTO scan_logs (order_id, scan_type, scanned_by, device_info)
  VALUES (p_order_internal_id, 'accept', v_user.user_id::TEXT, p_device_info);

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

> زر "جاهز" يعيد استخدام `rpc_scanner_mark_ready` الموجود (preparing → ready) — لا تغيير.

---

## 5. Supabase Edge Function — `foodics-webhook`
ملف: `supabase/functions/foodics-webhook/index.ts`

المنطق (مع الرد دائماً بـ 200):
```
POST /foodics-webhook
  → التحقق من التوقيع (webhook_secret من البند 3)   → فشل؟ 401
  → event != 'order.created'?                        → 200 ignored
  → استخراج: foodics_order_id, number, branch.id, type
  → موجود مسبقاً (foodics_order_id)?                 → 200 duplicate
  → ربط الفرع من foodics_branch_mapping              → غير موجود؟ 200 + log
  → INSERT orders (status='new', source='foodics', accepted_at=NULL)
  → 200 created
```
- نشر: `supabase functions deploy foodics-webhook --no-verify-jwt`
- يستخدم `SUPABASE_SERVICE_ROLE_KEY` (يتجاوز RLS تلقائياً).
- ⚠️ التحقق من التوقيع لا يُكتب نهائياً إلا بعد معرفة آلية Foodics الفعلية (البند 3).

### المهمة 6 — Seed ربط الفروع
ملف: `supabase/migrations/018_seed_foodics_branch_mapping.sql` (يُملأ بعد `GET /branches`):
```sql
INSERT INTO foodics_branch_mapping (foodics_branch_id, branch_id)
SELECT '<FOODICS_ERQAA_ID>',  id FROM branches WHERE code='Erqaa-01'
UNION ALL SELECT '<FOODICS_LABAN_ID>', id FROM branches WHERE code='Laban-02'
UNION ALL SELECT '<FOODICS_MALQA_ID>', id FROM branches WHERE code='AlMalqa-03';
```

---

## 6. تغييرات الواجهة (Frontend)

### المهمة 7 — `useOrders.js`
- توسيع الـ fetch + الفلاتر لتشمل `new`:
  ```js
  .in('status', ['new', 'preparing', 'ready'])
  const incoming  = orders.filter(o => o.status === 'new')
  return { orders, incoming, preparing, ready, newOrderFlag, refetch }
  ```
- Realtime موجود بالفعل ويغطي `branch_id=eq.${branchId}` — لا تغيير في الاشتراك.

### المهمة 8 — `Kitchen.jsx` (أكبر تغيير في الواجهة)
- يعرض الآن قسمين (أو قائمة بحالتين):
  - **طلبات جديدة** (`new`): كل بطاقة فيها زر **"استلام"** → `rpc_kitchen_accept_order`.
  - **قيد التجهيز** (`preparing`): كل بطاقة فيها زر **"جاهز"** → `rpc_scanner_mark_ready` (الموجود).
- مودال تأكيد لكل زر (نفس نمط المودال الحالي).
- عدّاد الهيدر = عدد `new` + `preparing`.

### المهمة 9 — `DisplayDashboard.jsx` (شاشة العميل) — تغيير بسيط
- **لا تعرض حالة `new`** — العميل يرى الطلب فقط بعد الاستلام.
- العمود الأول "قيد التجهيز" = `preparing`، الثاني "جاهز للاستلام" = `ready`. (مطابق للحالي تقريباً؛ فقط نتأكد أن `new` مستبعدة — وهي مستبعدة تلقائياً لأنها ليست preparing/ready.)
- `OrderCard.jsx`: إضافة شارة نوع الطلب (`order_type`) ورقم Foodics اختيارياً.

### مصير ماسح QR (`useScanner.js` / `Scanner.jsx`)
في التدفق الجديد المسح **اختياري** (كل العمليات صارت أزرار). الخياران:
- **(أ)** تعطيله مؤقتاً (الأبسط).
- **(ب)** إعادة استخدامه كبديل لزر "جاهز": مسح → بحث عن الطلب → إن كان `preparing` يحوّله `ready` (نفس منطق الخطة القديمة، المسح = جاهز فقط، وتُحذف منطق الإنشاء `rpc_scanner_insert_order`).
- **التوصية:** (ب) لاحقاً — لا يُعطّل التكامل الأساسي.

---

## 7. التحقق من تطابق خطوات "وصول الطلب" — هل التدفق مطبّق؟

| الخطوة | مطبّقة؟ | الاعتماد |
|--------|---------|----------|
| الطلب يدخل تلقائياً من Foodics | ✅ ممكنة | webhook + Edge Function (المهمة 5) + بيانات Foodics |
| يظهر فوراً بالمطبخ كـ "جديد" | ✅ ممكنة | Realtime مفعّل على `orders` بالفعل + `useOrders` بعد توسيعها للـ `new` |
| زر "استلام" → قيد التجهيز | ✅ ممكنة | `rpc_kitchen_accept_order` (المهمة 4) + `Kitchen.jsx` |
| يظهر بشاشة العميل "قيد التجهيز" | ✅ ممكنة | `DisplayDashboard` يعرض `preparing` بالفعل |
| زر "جاهز" → جاهز للاستلام | ✅ ممكنة | `rpc_scanner_mark_ready` الموجود |
| الاكتمال التلقائي | ✅ يعمل حالياً | `rpc_display_complete_order` + مؤقّت Display |

**الخلاصة:** التدفق **مطبَّق بالكامل تقنياً** على البنية الحالية. لا يوجد عائق معماري — العائق الوحيد هو **بيانات Foodics (البنود 1-6 في القسم 3)**. كل التغييرات إضافية (additive) ولا تكسر النظام الحالي.

### مخاطر ونقاط انتباه
1. **التوقيع (webhook signature):** لا تنشر الـ Edge Function للإنتاج بدون التحقق من التوقيع وإلا أي شخص يقدر يحقن طلبات. (يعتمد على البند 3.)
2. **مدة التحضير:** تأكد من ضبط `scanned_at` عند الاستلام (مُعالَج في المهمة 4) وإلا تُحسب مدة خاطئة.
3. **Realtime على `new`:** الاشتراك الحالي عام على الجدول، لكن تأكد أن `useOrders` و`Kitchen` يتعاملان مع الحالة الجديدة.
4. **صوت الإشعار:** حالياً يصدر على أي INSERT. قد نريد صوتاً عند `new` (مطبخ) وصوتاً مختلفاً عند `preparing` (شاشة العميل) — قرار تشغيلي لاحق.
5. **طلبات الكاشير:** تأكيد البند 6 ضروري وإلا تظهر طلبات الأونلاين فقط.
6. **الإلغاء/التعديل من Foodics:** خارج النطاق الآن؛ يمكن لاحقاً عبر `order.updated` لإزالة الملغاة.

---

## 8. ترتيب التنفيذ (بعد وصول بيانات Foodics)

```
المهمة 1: DB — توسيع orders (حالة new + أعمدة Foodics + accepted_at)
المهمة 2: DB — foodics_config + foodics_branch_mapping
المهمة 3: DB — توسيع scan_logs
المهمة 4: DB — rpc_kitchen_accept_order
المهمة 5: Edge Function — foodics-webhook (+ التحقق من التوقيع)
المهمة 6: Seed — ربط الفروع (يحتاج GET /branches)
المهمة 7: Frontend — useOrders (دعم new)
المهمة 8: Frontend — Kitchen (قسم جديد + زر استلام)
المهمة 9: Frontend — DisplayDashboard / OrderCard (شارات + استبعاد new)
بعدها: تحديث PROJECT_REFERENCE.md + اختبار E2E
```
التبعيات: 1-3 مستقلة. 4 تعتمد على 1. 5 تعتمد على 1-2. 6 تعتمد على 2. 7-9 تعتمد على 1. الاختبار أخيراً.

---

## 9. اختبار E2E (بعد التنفيذ)

```bash
# طلب جديد
curl -X POST https://<REF>.supabase.co/functions/v1/foodics-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"order.created","data":{"id":"t-001","number":5001,"type":2,"branch":{"id":"<FOODICS_BRANCH_ID>"}}}'
# متوقع: created → يظهر بالمطبخ كـ "جديد"

# تكرار نفس الطلب → duplicate
# حدث غير مدعوم order.updated → ignored
```
يدوياً: مطبخ → "استلام" → يظهر بشاشة العميل قيد التجهيز → "جاهز" → ينتقل لجاهز → يكتمل تلقائياً.
تنظيف: `DELETE FROM orders WHERE foodics_order_id LIKE 't-%';`
