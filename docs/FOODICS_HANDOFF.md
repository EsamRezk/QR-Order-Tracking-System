# 🔌 وثيقة التسليم والتكامل مع Foodics — كبة زون

> **التاريخ:** 2026-06-24 (محدّث)
> **الغرض:** توثيق كل ما تم تنفيذه في النظام للتحوّل الكامل إلى Foodics، وتحديد البيانات المطلوبة من Foodics بدقة لإكمال التشغيل.
> **الحالة:** ✅ التكامل يعمل end-to-end على Sandbox (طلب حقيقي من iPad Cashier يظهر في المطبخ). ⏳ المتبقي للإنتاج: تقليل زمن تسليم فوديكس (القسم 6) + ضمان بقاء الـ webhook مفعّلاً.
>
> **🔑 أهم اكتشاف (2026-06-24):** webhook `order.created` يحمل **الطلب كاملاً داخل `payload.order`** (الفرع/الرقم/النوع)، وليس `entity.id` فقط. لذلك الـ Edge Function تقرأ الطلب **مباشرة من الـ webhook بدون أي نداء API** — ما ألغى مشكلة الصلاحيات (403) والحاجة لـ `orders.limited.read` و حدّ المعدّل نهائياً.

---

## 1. ملخص التغيير

تم **إلغاء نظام مسح QR نهائياً**. مصدر الطلبات الوحيد الآن هو **Foodics** عبر Webhook.

### التدفق الجديد بالكامل
```
Foodics (طلب جديد)
  → webhook: order.created
  → Edge Function ينشئ الطلب بحالة "جديد" (new)
  → يظهر في شاشة المطبخ ضمن قسم "طلبات جديدة"
  → الموظف يضغط "استلام الطلب"  → الحالة: قيد التجهيز (preparing)
       → يظهر فوراً في شاشة العميل ضمن "قيد التحضير"
  → الموظف يضغط "جاهز"          → الحالة: جاهز (ready)
       → ينتقل في شاشة العميل إلى "جاهز للاستلام"
  → تلقائياً بعد 5 دقائق         → مكتمل (completed) ويختفي
```

---

## 2. ما تم تنفيذه (✅ جاهز)

### 2.1 إلغاء QR (حُذف نهائياً)
| العنصر | الإجراء |
|--------|---------|
| `src/pages/Scanner.jsx` + `Scanner.css` | **حُذف** |
| `src/components/ScannerView.jsx` + `.css` | **حُذف** |
| `src/hooks/useScanner.js` | **حُذف** |
| `src/utils/parseQR.js` | **حُذف** |
| `generate-qrcodes.html` | **حُذف** |
| مكتبة `html5-qrcode` | **أُزيلت** من `package.json` |
| مسار `/scan` | **أُزيل** من `App.jsx` + كل المراجع (Sidebars, AuthContext, AddUser, ProtectedRoute, Admin, Logs, BranchSelect) |
| `manifest.json` `start_url` | تغيّر من `/scan` إلى `/kitchen` |
| المسار الافتراضي للموظف | تغيّر من `/scan` إلى `/kitchen` (يشمل معالجة المستخدمين القدامى المخزّن لهم `/scan`) |

### 2.2 قاعدة البيانات (migrations جاهزة — تُشغّل على Supabase)
| الملف | المحتوى |
|-------|---------|
| `supabase/migrations/014_foodics_orders_flow.sql` | إضافة حالة `new` + أعمدة `source`, `foodics_order_id`, `foodics_order_number`, `order_type`, `accepted_at`, `accepted_by` + فهرس منع التكرار |
| `supabase/migrations/015_foodics_config_and_mapping.sql` | جدولا `foodics_config` و `foodics_branch_mapping` |
| `supabase/migrations/016_scan_logs_types.sql` | توسيع `scan_type` ليشمل `accept` و `ready_scan` |
| `supabase/migrations/017_rpc_kitchen_flow.sql` | دالة `rpc_kitchen_accept_order` (new → preparing) |
| `supabase/migrations/018_seed_foodics_branch_mapping.sql` | **قالب** ربط الفروع (يُملأ بعد جلب IDs من Foodics) |

### 2.3 Edge Function (الـ Endpoint)
- المسار: `supabase/functions/test-foodics-webhook/index.ts`
- **المنطق (مُحدّث 2026-06-24 بعد فحص الـ payload الحقيقي):** webhook `order.created` يحمل الطلب كاملاً في `payload.order`. لذلك الـ function:
  1. تقرأ الطلب **مباشرة من `payload.order`** (بدون أي نداء API)، 2. تربط الفرع عبر `foodics_branch_mapping`، 3. تنشئ الطلب بحالة `new`. (منع التكرار عبر فهرس فريد + الرد دائماً 200.)
  - **مسار احتياطي:** لو لم يحمل الـ webhook الطلب كاملاً → يُجلب عبر `GET /orders?filter[id]={id}` (scope: `orders.list`). ⚠️ فوديكس تتجاهل `filter[id]` وترجع القائمة، لذا نبحث عن الطلب بمعرّفه بـ `.find()` لا `data[0]`.
- **لا حاجة لـ `orders.limited.read`** ولا لأي scope إضافي طالما الـ webhook يحمل الطلب (المسار الأساسي).
- **الرابط المسجَّل في Foodics:**
  ```
  https://ucpudjjahbctzluseipo.supabase.co/functions/v1/test-foodics-webhook
  ```
- النشر: `npx supabase functions deploy test-foodics-webhook --no-verify-jwt`
- سكربتات مساعدة: `scripts/foodics-list-branches.mjs` (الفروع)، `scripts/foodics-check-webhook.mjs` (فحص تسجيل الـ webhook)، `scripts/foodics-postman-collection.json` (اختبار).

### 2.4 الواجهة (Frontend)
| الملف | التغيير |
|-------|---------|
| `src/hooks/useOrders.js` | يجلب الآن `new` + `preparing` + `ready`؛ يُصدّر `incoming` (الطلبات الجديدة) |
| `src/pages/Kitchen.jsx` | قسمان: **"طلبات جديدة"** (زر استلام بنفسجي) + **"قيد التحضير"** (زر جاهز أخضر)؛ مودال تأكيد لكل إجراء |
| `src/pages/Kitchen.css` | ستايلات الأقسام + زر الاستلام + شارة نوع الطلب |
| `src/components/OrderCard.jsx` | شارة نوع الطلب (محلي/استلام/توصيل) على شاشة العميل |
| `src/pages/DisplayDashboard.jsx` | صوت التنبيه يصدر عند **استلام** الطلب (دخوله لشاشة العميل)، لا عند إنشائه في فوديكس |

### 2.5 الحالة بعد التنفيذ
- ✅ `npm run build` ينجح.
- ✅ لا أخطاء lint في الملفات المعدّلة.
- ⚠️ النظام حالياً **لن تظهر فيه طلبات** حتى يُفعّل webhook فوديكس (لأن مصدر QR أُزيل). هذا متوقع ومقصود.

---

## 3. المطلوب من Foodics (⏳ الباقي لإكمال التشغيل)

> بعد قراءة دليل فوديكس، تقلّصت القائمة. هذه هي البنود المتبقية فعلاً:

| # | المطلوب | الحالة | أين يُستخدم |
|---|---------|--------|-------------|
| 1 | **Access Token** | ⏳ أُرسل في إيميل من `no-reply@mail.foodics.com` إلى `foodics@kebbazone.com` — يلزم إحضاره (راجع Spam) | `foodics_config.access_token` |
| 2 | **تسجيل الـ Webhook** على رابطنا مع حدث `order.created` | ⏳ يتم من إعدادات التطبيق أو بمراسلة `support@foodics.com` | إعداد فوديكس |
| 3 | **تأكيد** أن `order.created` يُطلَق لطلبات الكاشير + الأونلاين | ⏳ سؤال تشغيلي | — |
| 4 | الـ **Branch IDs** | ✅ نجلبها بأنفسنا عبر `scripts/foodics-list-branches.mjs` فور توفّر التوكن | `018_...sql` |
| 5 | الـ **Scopes** | ✅ من الدليل: `general.read` + `orders.limited.read` (الأقل المطلوب لتكاملنا) | إعداد التطبيق |

### تم حلّها من الدليل (لم تعد مطلوبة)
- ~~Webhook signature/HMAC~~ → فوديكس لا ترسل توقيعاً؛ الأمان عبر جلب الطلب بالتوكن.
- ~~عيّنة JSON للطلب~~ → الـ webhook يرسل `entity.id` فقط، ونجلب التفاصيل من `GET /orders/{id}`.

### أسئلة مباشرة لفريق Foodics (مختصرة)
1. كيف نسجّل **Webhook URL** الخاص بنا لهذا الحساب (Sandbox 922240)، وهل `order.created` متاح؟
2. هل `order.created` يُطلَق لطلبات **الكاشير (POS)** أيضاً أم للأونلاين فقط؟
3. تأكيد أن الـ **Access Token** المُرسَل صالح لـ `general.read` + `orders.limited.read`.

### بيانات حساب Sandbox (من الدليل)
- Console: `console-sandbox.foodics.com` — Email: `foodics@kebbazone.com` — Account: `922240`
- Base URL (Sandbox): `https://api-sandbox.foodics.com/v5` (مضبوط افتراضياً في `foodics_config.api_base_url`)

---

## 4. خطوات الإكمال بعد وصول بيانات Foodics

```
1) شغّل migrations على Supabase بالترتيب: 014 → 015 → 016 → 017
2) خزّن التوكن:
     INSERT INTO foodics_config (business_id, access_token)
     VALUES ('922240', '<ACCESS_TOKEN>');
3) اجلب الفروع واملأ الربط:
     FOODICS_TOKEN=<ACCESS_TOKEN> node scripts/foodics-list-branches.mjs
     ثم شغّل 018_seed_foodics_branch_mapping.sql بالقيم
4) انشر الـ Edge Function:
     supabase functions deploy test-foodics-webhook --no-verify-jwt
5) سجّل الرابط في Foodics مع حدث order.created
6) اختبر بطلب حقيقي → يظهر في المطبخ كـ "جديد"
```

### اختبار يدوي سريع (curl)
```bash
# يحتاج: توكن مخزّن + ربط مُعدّ + معرّف طلب حقيقي من حساب فوديكس
curl -X POST https://ucpudjjahbctzluseipo.supabase.co/functions/v1/test-foodics-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"order.created","entity":{"type":"order","id":"<REAL_FOODICS_ORDER_ID>"}}'
# متوقع: {"status":"created","order_id":"..."}
# تنظيف بعد الاختبار: DELETE FROM orders WHERE source = 'foodics';
```

---

## 6. زمن التسليم (Latency) — رصد فعلي 2026-06-24

قياسات من طلبات حقيقية على Sandbox:

| الحدث | طلب #7 | طلب #8 |
|-------|--------|--------|
| `opened_at` | 10:56:22 | 11:05:03 |
| `closed_at` | 10:56:26 | 11:05:11 |
| `created_at` (فوديكس) | 10:57:26 | 11:06:00 |
| وصل الـ webhook عندنا | 10:57:28 | 11:06:02 |

**التقسيم:**
- `closed_at` → `created_at` = **49–60 ثانية** ← تأخير **فوديكس** (مزامنة الجهاز بالسحابة، وغالباً batching؛ في Sandbox كانت طلبات متعددة تُنشأ دفعة واحدة).
- `created_at` → وصول عندنا = **~2 ثانية** (تسليم الـ webhook).
- معالجتنا + بثّ Realtime للمطبخ = أجزاء من الثانية.

**الخلاصة:** الجزء الذي نتحكم فيه (~2–3 ثوانٍ) ممتاز وثابت. التأخير الكبير (~1 دقيقة) **كله من فوديكس** ولا يُحسّن من جهتنا — وهو موضوع الضغط على فوديكس للإنتاج (مستهدف ≤5 ثوانٍ من لحظة الطلب). الحدّ الأدنى النظري end-to-end محكوم بـ (تسليم webhook ~2ث + معالجتنا ~1ث) ≈ **3–4 ثوانٍ**، بشرط أن تُنشئ فوديكس السجل فوراً (جهاز متصل، بلا batching).

---

## 5. مراجع

- خطة التكامل التفصيلية: `docs/plans/2026-06-21-foodics-realtime-flow-plan.md`
- وثيقة النظام الحالي: `docs/SYSTEM_DOCUMENTATION_AR.md`
- المرجع الشامل: `PROJECT_REFERENCE.md`
- وثائق Foodics: [scopes](https://apidocs.foodics.com/core/scopes.html) · [webhooks](https://apidocs.foodics.com/core/webhooks.html) · [introduction](https://apidocs.foodics.com/core/introduction.html)
