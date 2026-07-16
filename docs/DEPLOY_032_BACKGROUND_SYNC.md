# 🚀 دليل النشر — Optimistic UI + المزامنة الخلفية (migration 032)

> **انسخ والصق بالترتيب. متعملش خطوة قبل اللي قبلها.**
> **ابدأ بالستيجنج كله (أ)، جرّب، وبعدين البرودكشن (ب)، وأخيراً الواجهة (ج).**

| البيئة | Project Ref |
|--------|-------------|
| ستيجنج | `mbmrcvazjdzkarysqwgb` |
| برودكشن | `ucpudjjahbctzluseipo` |

> ⚠️ **الـ CI/CD (`git push`) ينشر الواجهة فقط.** الـ Edge Functions تُنشر بإيدك من التيرمنال.

---

# (أ) الستيجنج — `mbmrcvazjdzkarysqwgb`

## أ-1) فعّل الإضافتين

Dashboard → اختر مشروع الستيجنج → **Database** → **Extensions** → دوّر وفعّل:

- ✅ `pg_cron`
- ✅ `pg_net`

## أ-2) SQL Editor → أسرار الفولت

Dashboard → **SQL Editor** → **New query** → الصق ونفّذ (Run):

```sql
select vault.create_secret('https://mbmrcvazjdzkarysqwgb.supabase.co', 'kz_project_url');
select vault.create_secret('9ffd6fe8b2d4f5108beb4e017bd5d877be59b0435f8b48224fbf8635c08e520d', 'kz_resync_secret');
```

**تحقّق:**
```sql
select name from vault.decrypted_secrets where name like 'kz_%';
```
✅ المتوقع: صفّان (`kz_project_url` و `kz_resync_secret`).

## أ-3) SQL Editor → الـ migration

**SQL Editor** → **New query** → افتح الملف ده وانسخ **كل** محتواه والصقه ونفّذه:

```
supabase/migrations/032_foodics_background_sync.sql
```

**تحقّق:**
```sql
select jobname, schedule, active from cron.job where jobname = 'foodics-resync';
```
✅ المتوقع: صف واحد.
- `schedule = '30 seconds'` → ممتاز
- `schedule = '* * * * *'` → نسخة Postgres أقدم، وقع على الدقيقة (مقبول)
- **فاضي؟** → `pg_cron` مش متفعّل، ارجع لـ (أ-1) وأعد تنفيذ الـ migration.

## أ-4) التيرمنال → السر + نشر الـ Functions

افتح تيرمنال في مجلد المشروع:

```bash
cd "e:\KZQR\QR-Order-Tracking-System"
```

**لو أول مرة تستخدم الـ CLI:**
```bash
npx supabase login
```

**السر (نفس القيمة اللي في أ-2 بالحرف):**
```bash
npx supabase secrets set FOODICS_RESYNC_SECRET=9ffd6fe8b2d4f5108beb4e017bd5d877be59b0435f8b48224fbf8635c08e520d --project-ref mbmrcvazjdzkarysqwgb
```

**نشر الـ Functions (الترتيب ده بالظبط):**
```bash
npx supabase functions deploy foodics-webhook       --no-verify-jwt --project-ref mbmrcvazjdzkarysqwgb
npx supabase functions deploy test-foodics-webhook  --no-verify-jwt --project-ref mbmrcvazjdzkarysqwgb
npx supabase functions deploy foodics-update-status --no-verify-jwt --project-ref mbmrcvazjdzkarysqwgb
```

> ⚠️ `--no-verify-jwt` **إلزامية**. من غيرها الـ cron ياخد 401 والمزامنة الخلفية تموت بصمت.

## أ-5) جرّب على الستيجنج

شغّل الواجهة محلياً (الـ `.env` عندك موجّه للستيجنج أصلاً):
```bash
npm run dev
```

افتح `/kitchen?branch=Erqaa-01` واعمل الاختبارات دي:

| # | الاختبار | المتوقع |
|---|----------|---------|
| 1 | اضغط "جهز" → تأكيد | الموديل يقفل والكارت ينتقل **فوراً** (بلا "جاري التنفيذ") |
| 2 | افتح `/display?branch=Erqaa-01` في تاب تاني | الطلب ينتقل خلال أقل من ثانية |
| 3 | شوف الطلب في فوديكس | بقى Ready خلال ثوانٍ |

**تحقّق من المزامنة:**
```sql
select order_id, status, foodics_delivery_status, synced_to_foodics, foodics_sync_attempts
from orders where source = 'foodics'
order by created_at desc limit 5;
```
✅ المتوقع: `synced_to_foodics = true` خلال ثوانٍ.

### اختبار الرجوع (مهم)

DevTools → **Network** → **Offline** → اضغط "جهز" → تأكيد.

✅ المتوقع: الكارت ينتقل فوراً، وبعد ~ثانية **يرجع مكانه** + شريط تنبيه أحمر.

### اختبار شبكة الأمان (الأهم — دي الخاصية الجديدة)

```sql
-- 1) خرّب التوكن عمداً (غيّر آخر حرف) — احفظ القيمة الأصلية الأول!
select access_token from foodics_config;
update foodics_config set access_token = access_token || 'X';
```

اضغط "جهز" على طلب.
✅ المتوقع: الكارت ينتقل والقاعدة تتحدث (**المطبخ ما يقفش**)، بس:
```sql
select order_id, synced_to_foodics, foodics_sync_attempts
from orders order by created_at desc limit 3;
-- synced_to_foodics = false، و foodics_sync_attempts بيزيد كل شوية
```

```sql
-- 2) رجّع التوكن الصح
update foodics_config set access_token = left(access_token, length(access_token) - 1);
```

✅ المتوقع: **خلال 30 ثانية يتزامن لوحده** و `synced_to_foodics = true` بلا أي تدخل منك.

---

# (ب) البرودكشن — `ucpudjjahbctzluseipo`

**نفس الخطوات بالظبط، بس بالقيم دي:**

## ب-1) فعّل `pg_cron` + `pg_net` (Database → Extensions)

## ب-2) SQL Editor → الفولت

```sql
select vault.create_secret('https://ucpudjjahbctzluseipo.supabase.co', 'kz_project_url');
select vault.create_secret('978f03e57971fb2f6a8bdcd2e123a7a064ca81db045d34c53d769730105a84f0', 'kz_resync_secret');
```

## ب-3) SQL Editor → نفس الـ migration

الصق `032_foodics_background_sync.sql` كامل ونفّذه، ثم:
```sql
select jobname, schedule, active from cron.job where jobname = 'foodics-resync';
```

## ب-4) التيرمنال

```bash
npx supabase secrets set FOODICS_RESYNC_SECRET=978f03e57971fb2f6a8bdcd2e123a7a064ca81db045d34c53d769730105a84f0 --project-ref ucpudjjahbctzluseipo

npx supabase functions deploy foodics-webhook       --no-verify-jwt --project-ref ucpudjjahbctzluseipo
npx supabase functions deploy foodics-update-status --no-verify-jwt --project-ref ucpudjjahbctzluseipo
```

---

# (ج) الواجهة

## ج-1) تأكد إن GitHub Secrets فيها البرود

**GitHub → Settings → Secrets and variables → Actions** → لازم:
```
VITE_SUPABASE_URL = https://ucpudjjahbctzluseipo.supabase.co
VITE_SUPABASE_ANON_KEY = <anon key البرودكشن>
```

## ج-2) ادفع

```bash
npm run lint && npm run build
git add -A
git commit -m "Optimistic UI + background Foodics sync with guaranteed retry"
git push origin main
```

تابع في **GitHub → Actions** (النشر عبر FTP على cPanel — مش Vercel).

---

# 📊 المراقبة (احفظ الاستعلام ده)

الطلبات اللي لسه ما وصلتش فوديكس:

```sql
select id, order_id, status, foodics_delivery_status,
       foodics_sync_attempts, foodics_sync_next_at
from orders
where synced_to_foodics = false
  and source = 'foodics'
  and status in ('ready', 'completed')
order by foodics_sync_next_at;
```

- **فاضي** = كل حاجة متزامنة ✅
- `foodics_sync_attempts >= 20` → استنفدت المحاولات (~ساعتين ونص). الطلب **مش ضايع** —
  بياناته سليمة محلياً، بس فوديكس ما اتحدثتش. شوف لوجز الـ Edge Function (توكن منتهي؟ 404؟).
- `foodics_sync_attempts = 32767` → فشل دائم (404/422 — الطلب مش موجود في فوديكس بالتوكن ده).

---

# ↩️ التراجع (لو حصلت مشكلة)

**أوقف الـ sweeper فوراً** (المطبخ والقاعدة يفضلوا شغالين عادي):
```sql
select cron.unschedule('foodics-resync');
```

الطلبات تفضل محفوظة بـ `synced_to_foodics=false` جاهزة للاستئناف لما تعيد الجدولة
(بإعادة تنفيذ الـ migration).

**رجوع كامل للسلوك القديم:** `git revert` ثم أعد نشر الـ functions القديمة.
الأعمدة الجديدة إضافية وغير ضارة — سيبها.

---

# ❓ لو حاجة مشتغلتش

| العَرَض | السبب الغالب |
|---------|--------------|
| `cron.job` فاضي | `pg_cron` مش متفعّل → (أ-1) |
| `synced_to_foodics` فاضل false للأبد | الـ functions مش منشورة (لسه القديمة) → (أ-4) |
| الـ cron بيشتغل بس مفيش مزامنة | السر مش متطابق بين الفولت والـ function، أو نُشرت بلا `--no-verify-jwt` |
| الكارت بيرجع مكانه دايماً | القاعدة بترفض — شوف Console وجرّب `select * from cron.job_run_details limit 5` |

**لوجز الـ Edge Function:** Dashboard → Edge Functions → `foodics-update-status` → Logs.

**تنفيذات الـ cron:**
```sql
select status, return_message, start_time
from cron.job_run_details where jobname = 'foodics-resync'
order by start_time desc limit 5;
```
> طبيعي تلاقي تنفيذات كتير بلا نداء فعلي — المهمة فيها حارس `WHERE EXISTS`
> فمش بتنادي الـ function غير لما يكون فيه طلب معلق. ده مقصود.
