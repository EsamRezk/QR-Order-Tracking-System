# 📋 مرجع المشروع الشامل — QR Order Tracking System (كبة زون)

> **آخر تحديث:** 2026-07-03
> **ملاحظة مهمة:** يجب تحديث هذا الملف بعد كل تعديل في المشروع.

---

## 1. نظرة عامة

نظام تتبع الطلبات عبر QR Code لمطعم **كبة زون** (KebbaZone). يسمح بمسح طلبات المطاعم عبر QR وعرضها على شاشة العرض في الوقت الفعلي.

- **العميل:** مطعم كبة زون — فروع متعددة في الرياض
- **الهدف:** تتبع الطلبات من لحظة المسح → التحضير → جاهز → مكتمل
- **اللغة:** عربية (RTL)، خط Tajawal
- **Deploy:** Vercel
- **Backend:** Supabase (PostgreSQL + Realtime)

---

## 2. التقنيات (Tech Stack)

| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| React | 19.2.4 | UI Framework |
| Vite | 8.0.1 | Build tool |
| Tailwind CSS | 4.2.2 (via `@tailwindcss/vite`) | Styling |
| Supabase JS | 2.100.0 | Database + Realtime |
| React Router DOM | 7.13.2 | Routing |
| Recharts | 3.8.0 | Charts (Analytics page) |
| html5-qrcode | 2.3.8 | QR Code scanning |
| ExcelJS | 4.4.0 | تصدير سجل الطلبات إلى ملف Excel (.xlsx) منسّق |

---

## 3. هيكل المشروع (Project Structure)

```
e:\My Projects\QR Order Tracking System\
├── index.html                  # Entry HTML (RTL, Tajawal font)
├── package.json
├── vite.config.js              # Vite + React + Tailwind plugins
├── vercel.json                 # SPA rewrites
├── generate-qrcodes.html       # أداة طباعة QR للاختبار (20 كود)
├── .env                        # بيانات Supabase
│
├── public/
│   ├── favicon.svg
│   ├── manifest.json           # PWA manifest (start_url: /scan)
│   ├── notification.mp3        # صوت إشعار الطلب الجديد
│   └── sw.js                   # Service Worker (cache + offline)
│
├── src/
│   ├── main.jsx                # Entry point + SW registration
│   ├── App.jsx                 # Router + ErrorBoundary
│   ├── index.css               # CSS variables + animations
│   │
│   ├── lib/
│   │   └── supabase.js         # Supabase client init
│   │
│   ├── context/
│   │   └── AuthContext.jsx     # سياق المصادقة (login, logout, session — لا تنتهي إلا بـ logout)
│   │
│   ├── hooks/
│   │   ├── useBranch.js        # جلب بيانات الفرع من URL param
│   │   ├── useAdminBranch.js   # حفظ الفرع المختار من الأدمن في localStorage (يظل ثابتاً بين الصفحات)
│   │   ├── useHeartbeat.js    # تتبع الحضور (heartbeat كل 30 ثانية)
│   │   ├── useOrders.js        # جلب الطلبات + Realtime subscription
│   │   ├── useScanner.js       # منطق مسح QR + إنشاء/تحديث الطلبات
│   │   └── useSound.js         # تشغيل صوت الإشعار (Web Audio API)
│   │
│   ├── utils/
│   │   ├── formatTime.js       # دوال تنسيق الوقت بالعربية
│   │   ├── parseQR.js          # تفسير بيانات QR → {order_id, channel_link, location}
│   │   └── exportExcel.js      # تصدير سجل الطلبات إلى .xlsx منسّق (لوجو + ألوان)
│   │
│   ├── components/
│   │   ├── AppLogo.jsx         # لوجو كبة زون ثابت أعلى يسار الشاشة (fixed)
│   │   ├── AdminSidebar.jsx    # شريط جانبي للأدمن (كل الروابط) — يظهر لـ role: admin فقط
│   │   ├── UserSidebar.jsx     # شريط جانبي للمستخدم العادي (kitchen + logout)
│   │   ├── BranchSelector.jsx  # قائمة منسدلة لاختيار الفرع (غير مستخدمة حالياً في أي مكان)
│   │   ├── Dropdown.jsx + Dropdown.css  # قائمة منسدلة موحّدة لكل النظام (مُستخرجة من Analytics.jsx)، تُستخدم في AdminSidebar
│   │   ├── LogoutButton.jsx    # زر تسجيل الخروج (يظهر في كل الصفحات)
│   │   ├── LoadingScreen.jsx   # شاشة تحميل بلوجو متحرك (bounce) + CSS
│   │   ├── LoadingScreen.css
│   │   ├── OrderCard.jsx       # بطاقة الطلب (preparing / ready)
│   │   ├── PreparingColumn.jsx # عمود "قيد التحضير" + CSS
│   │   ├── PreparingColumn.css
│   │   ├── ProtectedRoute.jsx  # حماية المسارات حسب الصلاحية
│   │   ├── ReadyColumn.jsx     # عمود "جاهز" + CSS
│   │   ├── ReadyColumn.css
│   │   ├── ScannerView.jsx     # كاميرا QR (html5-qrcode) + CSS
│   │   ├── ScannerView.css
│   │   └── StatsCard.jsx       # بطاقة إحصائية بسيطة
│   │
│   ├── pages/
│   │   ├── AddUser.jsx           # صفحة إضافة المستخدمين (admin فقط) + CSS
│   │   ├── AddUser.css
│   │   ├── DisplayDashboard.jsx  # شاشة العرض الرئيسية + CSS
│   │   ├── DisplayDashboard.css
│   │   ├── Login.jsx             # صفحة تسجيل الدخول + CSS
│   │   ├── Login.css
│   │   ├── Logs.jsx             # صفحة سجل النظام + CSS
│   │   ├── Logs.css
│   │   ├── Scanner.jsx           # صفحة الماسح + CSS
│   │   ├── Scanner.css
│   │   ├── Analytics.jsx         # صفحة التحليلات + CSS
│   │   ├── Analytics.css
│   │   ├── Admin.jsx             # صفحة إدارة الفروع + CSS
│   │   ├── Admin.css
│   │   ├── Kitchen.jsx            # شاشة المطبخ + CSS
│   │   ├── Kitchen.css
│   │   ├── BranchSelect.jsx      # صفحة اختيار الفرع + CSS
│   │   └── BranchSelect.css
│   │
│   └── assets/
│       └── img/
│           └── KebbaZone Logo.png
│
└── supabase/
    └── migrations/
        ├── 001_create_branches.sql
        ├── 002_create_orders.sql
        ├── 003_create_scan_logs.sql
        ├── 004_rls_policies.sql
        ├── 005_seed_branches.sql
        ├── 006_create_users.sql
        ├── 007_users_rls_and_functions.sql
        ├── 008_seed_admin_user.sql
        ├── 009_secure_rls_sessions.sql
        ├── 009_seed_laban_users.sql
        ├── 010_session_auto_refresh.sql
        ├── 011_allow_concurrent_sessions.sql
        ├── 012_active_sessions.sql
        ├── 013_rpc_update_user.sql
        ├── 014_foodics_orders_flow.sql        # حالة new + أعمدة Foodics + تتبع الاستلام
        ├── 015_foodics_config_and_mapping.sql # foodics_config + foodics_branch_mapping
        ├── 016_scan_logs_types.sql            # accept / ready_scan
        ├── 017_rpc_kitchen_flow.sql           # rpc_kitchen_accept_order (موقوف بالواجهة)
        ├── 018_seed_foodics_branch_mapping.sql  # ربط فرع Sandbox الواحد (B01) — تيست فقط
        ├── 019_foodics_delivery_flow.sql      # الورك فلو الجديد: cancelled + أعمدة delivery + RPCs المزامنة العكسية
        ├── 020_drop_orders_order_id_branch_unique.sql
        ├── 021_foodics_delivery_flow.sql
        ├── 022_seed_foodics_branch_mapping_prod.sql  # ربط فروع الإنتاج الـ10 (B01..B10) بمعرّفات Foodics الحقيقية
        ├── 023_bulk_deliver.sql               # rpc_kitchen_bulk_deliver — سلة الحذف (تحويل جماعي لتم الاستلام)
        ├── 023_branch_display_settings.sql    # إعدادات شاشة العرض للفرع
        ├── 024_branch_display_mode.sql        # display_mode لشاشة العرض
        ├── 025_orders_display_view.sql        # v_orders_display (raw_qr_data مُقلّم) + فهارس
        ├── 026_sessions_never_expire.sql
        ├── 027_analytics_server_side.sql      # التحليلات في القاعدة: أعمدة delivery_app/app_number/foodics_ref (trigger) + فهارس created_at + rpc_analytics_summary
        ├── 028_branch_bootstrap.sql           # rpc_branch_bootstrap — تحميل أولي برحلة واحدة لشاشتي الفرع والعرض
        ├── 029_top_products.sql               # order_items + rpc_top_products (أعلى المنتجات مبيعاً)
        ├── 030_top_products_modifiers.sql     # عمود modifiers + التجميع على (product_id + modifiers)
        └── 031_display_header_toggle.sql      # show_header — توجل إظهار/إخفاء هيدر شاشة العرض من شاشة الفرع
```

> **Edge Functions:** `supabase/functions/foodics-webhook` (inbound — القناة الرسمية) · `foodics-update-status` (outbound — المزامنة العكسية) · `test-foodics-webhook` (alias للتوافق).

---

## 4. Routes (المسارات)

| المسار | الصفحة | الأدوار المسموحة | الوصف |
|--------|--------|-----------------|-------|
| `/login` | `Login` | عام | تسجيل الدخول |
| `/display?branch=CODE` | `DisplayDashboard` | screen, admin | شاشة عرض الطلبات (للتلفاز/الشاشة) |
| `/analytics` | `Analytics` | user, admin | تقارير وإحصائيات |
| `/admin` | `Admin` | admin | إدارة الفروع (CRUD) |
| `/kitchen?branch=CODE` | `Kitchen` | user, admin | شاشة المطبخ — عرض الطلبات قيد التحضير + زر جاهز |
| `/add-user` | `AddUser` | admin | إضافة وإدارة المستخدمين |
| `/logs` | `Logs` | admin | سجل النظام — المتصلون الآن |
| `/*` | Redirect → `/login` | — | أي مسار غير معروف |

- إذا لم يتم تحديد `?branch=` في `/display` أو `/scan` أو `/kitchen`، يتم عرض صفحة اختيار الفرع `BranchSelect`.
- جميع المسارات (عدا `/login`) محمية بـ `ProtectedRoute`.

---

## 5. قاعدة البيانات (Database Schema)

### جدول `branches` (الفروع)
```sql
id              UUID (PK, auto)
name_ar         TEXT NOT NULL          -- الاسم بالعربية
name_en         TEXT NOT NULL          -- الاسم بالإنجليزية
code            TEXT UNIQUE NOT NULL   -- رمز الفرع (مثل Erqaa-01)
location_label  TEXT NOT NULL          -- عنوان الموقع
is_active       BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ DEFAULT now()
```

### جدول `orders` (الطلبات)
```sql
id                     UUID (PK, auto)
order_id               TEXT NOT NULL              -- رقم الطلب من QR
branch_id              UUID FK→branches(id)       -- الفرع
channel_link           TEXT                       -- رابط القناة (jahez, hungerstation...)
status                  TEXT CHECK ('new','preparing','ready','completed','cancelled')
scanned_at              TIMESTAMPTZ DEFAULT now()  -- بداية احتساب مدة التحضير
ready_at                TIMESTAMPTZ                -- وقت الجاهزية
delivered_at            TIMESTAMPTZ                -- وقت "تم التسليم"
completed_at            TIMESTAMPTZ                -- وقت الاكتمال
prep_duration_seconds   INTEGER (GENERATED)        -- مدة التحضير (تلقائي)
raw_qr_data             JSONB                      -- raw_qr_data.foodics_order = الطلب الخام من فوديكس
created_at              TIMESTAMPTZ DEFAULT now()
-- أعمدة Foodics (migrations 014 + 019):
source                  TEXT DEFAULT 'qr'          -- 'foodics' | 'qr'
foodics_order_id        TEXT (UNIQUE partial)      -- UUID الطلب في فوديكس (للـ PUT)
foodics_order_number    TEXT                       -- الرقم المعروض
order_type              TEXT                       -- dine_in | pickup | delivery | drive_thru
order_source            INTEGER                    -- 1=POS, 2=API, 3=Call Center
foodics_delivery_status INTEGER                    -- آخر delivery_status من فوديكس (1,2,5,6)
synced_to_foodics       BOOLEAN DEFAULT false      -- هل آخر تحديث وصل فوديكس؟
accepted_at/accepted_by                            -- (موقوف) تتبع خطوة الاستلام
-- أعمدة التحليلات المحسوبة (migration 027 — يملؤها trigger orders_analytics_fields
-- عند INSERT/UPDATE OF raw_qr_data/channel_link، بمنطق مطابق لـ deliveryApps.js):
delivery_app            TEXT                       -- keeta|hungerstation|jahez|chefz|ninja|mrsool|toyou|direct
app_number              TEXT                       -- رقم الطلب داخل التطبيق (external_number بعد ":")
foodics_ref             TEXT                       -- رقم فوديكس المرجعي (raw.foodics_order.reference)
UNIQUE(order_id, branch_id)
```
- ⚠️ عند تعديل أسماء/aliases التطبيقات في `deliveryApps.js` يجب تحديث `kz_resolve_delivery_app` في القاعدة وإعادة الـ backfill (migration 027).
- `prep_duration_seconds` محسوب تلقائيًا: `EXTRACT(EPOCH FROM (ready_at - scanned_at))`

### جدول `scan_logs` (سجل المسح)
```sql
id          UUID (PK, auto)
order_id    UUID FK→orders(id)
scan_type   TEXT CHECK ('first_scan','second_scan')
scanned_by  TEXT
scanned_at  TIMESTAMPTZ DEFAULT now()
device_info TEXT
```

### جدول `users` (المستخدمون)
```sql
id          UUID (PK, auto)
username    TEXT UNIQUE NOT NULL
password    TEXT NOT NULL               -- يتم هاشه تلقائياً عبر trigger (bcrypt)
branch_id   UUID FK→branches(id)       -- الفرع (اختياري)
route       TEXT NOT NULL DEFAULT '/scan' -- المسار بعد الدخول
role        TEXT CHECK ('admin','user','screen') DEFAULT 'user'
created_at  TIMESTAMPTZ DEFAULT now()
```
- **Trigger:** `trigger_hash_password` — يقوم بهاش الباسورد تلقائياً عند INSERT/UPDATE
- **RLS:** مفعّل بدون policies (لا يمكن الوصول المباشر من العميل)

### جدول `active_sessions` (الجلسات النشطة)
```sql
id              UUID (PK, auto)
user_id         UUID FK→users(id) ON DELETE CASCADE
current_page    TEXT NOT NULL DEFAULT '/'
last_heartbeat  TIMESTAMPTZ DEFAULT now()
started_at      TIMESTAMPTZ DEFAULT now()
```
- **Unique constraint:** user_id (جلسة واحدة لكل مستخدم)
- **RLS:** مفعّل بدون policies (الوصول عبر RPC فقط)
- **فهرسة:** idx_active_sessions_user, idx_active_sessions_heartbeat

### RPC Functions (دوال قاعدة البيانات)
| الدالة | الوصف | الحماية |
|--------|-------|---------|
| `authenticate_user(p_username, p_password)` | تسجيل الدخول + التحقق من الباسورد | SECURITY DEFINER |
| `create_user(p_admin_id, ...)` | إنشاء مستخدم جديد | admin فقط |
| `delete_user(p_admin_id, p_user_id)` | حذف مستخدم | admin فقط (لا يحذف نفسه) |
| `list_users(p_admin_id)` | جلب قائمة المستخدمين (بدون باسورد) | admin فقط |
| `rpc_update_user_secure(p_session_id, p_target_user_id, p_username, p_password, p_branch_id, p_route, p_role)` | تعديل بيانات مستخدم (الباسورد اختياري) | admin فقط |
| `rpc_upsert_heartbeat(p_session_id, p_current_page)` | تحديث حالة الحضور (heartbeat كل 30 ثانية) | SECURITY DEFINER |
| `rpc_remove_presence(p_session_id)` | حذف الحضور عند الخروج | SECURITY DEFINER |
| `rpc_get_online_users(p_session_id, p_timeout_seconds)` | جلب المتصلين (admin فقط) | SECURITY DEFINER |
| `rpc_kitchen_mark_ready_synced(p_session_id, p_order_internal_id, p_device_info, p_synced)` | زر "جاهز": preparing→ready + ختم المزامنة | admin/user |
| `rpc_kitchen_mark_delivered(p_session_id, p_order_internal_id, p_device_info, p_synced)` | زر "تم التسليم": ready→completed | admin/user |
| `rpc_kitchen_bulk_deliver(p_session_id, p_branch_id, p_scope, p_device_info)` | سلة الحذف: تحويل جماعي (preparing/ready/both) → completed + scan_logs، ترجع قائمة الطلبات لمزامنة فوديكس | admin/user |
| `rpc_analytics_summary(p_from, p_branch_id)` | ملخص التحليلات في رحلة واحدة: `{total, avg, fastest, slowest, by_branch[], hourly[]}` — تجميع في القاعدة بلا JSONB (صفحة التحليلات) | anon/authenticated |

### RLS Policies
- `orders`: open access (all operations) for anon
- `scan_logs`: open access for anon
- `branches`: SELECT + INSERT + UPDATE for anon (no delete)
- `users`: RLS مفعّل بدون policies (الوصول عبر RPC فقط)
- Realtime مفعّل على `orders`

### البيانات الأولية (Seed)
```
عرقه     | Erqaa    | Erqaa-01    | Erqaa
ظهرة لبن | Laban    | Laban-02    | Laban
الملقا   | Al-Malqa | AlMalqa-03  | AlMalqa
```

---

## 6. المنطق التشغيلي (Business Logic)

### دورة حياة الطلب (الورك فلو الجديد — delivery-driven + مزامنة عكسية لفوديكس)
```
[Foodics webhook: order.delivery.created/updated مع delivery_status=1]
       → INSERT order (status: preparing مباشرة، source: foodics)   ← خطوة "الاستلام" أُلغيت
       ↓  (يظهر فوراً في المطبخ "قيد التحضير" + في شاشة العميل + صوت تنبيه)
[زر "جاهز" في المطبخ]
       → Edge Function foodics-update-status (action: ready)
       → PUT /orders/{id} {delivery_status: 2}  +  UPDATE status=ready, ready_at, foodics_delivery_status=2, synced_to_foodics + scan_log (ready_scan)
       ↓  (ينتقل لقسم "جاهز" في المطبخ + "جاهز للاستلام" عند العميل)
[زر "تم التسليم" في المطبخ]
       → Edge Function foodics-update-status (action: delivered)
       → PUT /orders/{id} {delivery_status: 5, driver_collected_at: <UTC>}  +  UPDATE status=completed, delivered_at, foodics_delivery_status=5 + scan_log (delivered)
       ↓
[completed] يختفي من المطبخ وشاشة العميل
```
- **إلغاء من فوديكس:** webhook بـ `order.status` = 3 (Declined) أو 7 (Void) → `status=cancelled` (إزالة من العرض).
- **forward-only:** الحالة لا تتراجع (preparing→ready→completed فقط)؛ محمي في الـ webhook (STATUS_RANK) وفي شروط الـ RPC.
- **معالجة فشل فوديكس:** لو فشل الـ PUT، يُحدَّث المحلي على أي حال (`synced_to_foodics=false`) حتى لا يتوقف المطبخ.
- **الإكمال التلقائي (5 دقائق) موقوف لطلبات foodics** — الإكمال صار صريحاً عبر زر "تم التسليم" (مع مزامنة). يبقى الـ auto-complete فعّالاً لطلبات qr القديمة فقط.
- **خطوة "الاستلام" (new → preparing) موقوفة في الواجهة** لكنها باقية في القاعدة (`rpc_kitchen_accept_order` + حالة `new`) قابلة للإرجاع.

> ملاحظة: مسح QR أُلغي نهائياً (2026-06-22). مصدر الطلبات الوحيد هو Foodics. الورك فلو الجديد موثّق في `KebbaZone_Foodics_Integration_Flow` و `docs/FOODICS_HANDOFF.md`.

### مزامنة فوديكس (delivery_status codes)
| الكود | المعنى | الاتجاه عندنا |
|------|--------|---------------|
| 1 | Sent to Kitchen | وارد (inbound) → preparing |
| 2 | Ready | صادر (outbound) عند زر "جاهز" |
| 5 | Delivered | صادر (outbound) عند زر "تم التسليم" + `driver_collected_at` (UTC) |
| 3/4 | Assigned/Enroute | تتولاها DMS — نتجاهلها |
| 6 | Cancelled | وارد → cancelled |

### تحديد قناة الطلب
```javascript
if (channel_link includes 'jahez')          → 'جاهز'
if (channel_link includes 'hungerstation')  → 'هنقرستيشن'
else                                        → 'مباشر'
```

### QR Code Format
QR يحتوي JSON:
```json
{
  "order_id": "KZ-1001",
  "channel_link": "https://hungerstation.com/order/1001",  // اختياري
  "location": "حي العرقة، الرياض"                          // اختياري
}
```
- إذا لم يكن JSON صالح، يتم استخدام النص كاملاً كـ `order_id`

---

## 7. متغيرات البيئة (.env)

```env
VITE_SUPABASE_URL=https://ucpudjjahbctzluseipo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_DEFAULT_BRANCH=Erqaa-01
VITE_READY_TIMEOUT_MINUTES=5         # مهلة الطلب الجاهز (دقائق)
VITE_SCAN_COOLDOWN_MS=2000           # فترة التبريد بين المسحات (مللي ثانية)
```

### 7.1 مشروعا Supabase (تيست / برودكشن) وتوجيه الواجهة

يوجد **مشروعان Supabase منفصلان** (قاعدة بيانات + edge function لكلٍّ منهما):

| الدور | Project Ref | الـ Edge Function | يُستخدم في |
|-------|-------------|-------------------|------------|
| **برودكشن** | `ucpudjjahbctzluseipo` | `foodics-webhook` | `npm run build` (عبر `.env`) |
| **تيست** | `mbmrcvazjdzkarysqwgb` | `test-foodics-webhook` | `npm run dev` (عبر `.env.development.local`) |

> ملاحظة تاريخية: المشروع القديم الذي اشتغل أصلاً صار **البرودكشن**، والمشروع الأحدث صار **التيست** (قلب الأدوار عمداً تفادياً لنسيان شيء عند الهجرة).

**توجيه الواجهة (Vite):**
- `.env` → قيم البرودكشن (يقرأها الـ build).
- `.env.development.local` → قيم التيست، يتجاوز `.env` في وضع `dev` فقط → **اللوكال يفتح على التيست تلقائياً**. (مُتجاهَل في git ضمن `.env.*.local`.)
- بعد تعديل أي ملف `.env*` يجب **إعادة تشغيل** خادم Vite.

**توجيه الـ webhooks تلقائي:** كل edge function تكتب في داتابيز مشروعها لأنها تقرأ `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` من بيئة المشروع المنشورة عليه. فهوك التيست → داتابيز التيست، وهوك البرود → داتابيز البرود، بلا إعداد إضافي.

> ⚠️ سبب شائع لـ "الأوردر مش ظاهر في المطبخ": الأوردر اتسجّل في مشروع والواجهة موجّهة للمشروع الآخر. تأكّد أن الواجهة موجّهة لنفس مشروع الـ webhook الذي اختبرت عليه.

---

## 8. تفاصيل الملفات الرئيسية

### 8.1 `App.jsx`
- `ErrorBoundary` class component لالتقاط الأخطاء
- `BrowserRouter` → `AuthProvider` → `Routes`
- جميع المسارات محمية بـ `ProtectedRoute` مع `allowedRoles`
- `/login` هو المسار العام الوحيد
- أي مسار غير معروف يوجه إلى `/login`

### 8.2 `main.jsx`
- `StrictMode` + `createRoot`
- تسجيل Service Worker

### 8.3 `index.css`
- متغيرات CSS: `--kz-primary: #FF5100`, `--kz-dark: #1E1810`, إلخ
- الرسوم المتحركة: `slideIn`, `fadeOut`, `pulse`, `scanLine`, `glowPulse`
- Scrollbar مخصص

---

### 8.4 Hooks

#### `useBranch.js`
- يقرأ `?branch=CODE` من URL
- يستدعي RPC واحدة **`rpc_branch_bootstrap(p_branch_code)`** (migration 028) ترجع الفرع + الطلبات + إعداد شاشة العرض معاً برحلة شبكة واحدة (بدل جلب الفرع وحده ثم انتظاره لجلب الباقي)
- يرجع: `{ branch, loading, error, branchCode, initialOrders, initialDisplaySetting }` — آخر اتنين بذرة أولية تُمرَّر لـ `useOrders`/`useBranchDisplaySetting` لتفادي رحلة جلب مكرّرة
- يصدّر أيضاً: `resolveBranchByLocation(location)` — يبحث بالـ `location_label` (لا يستخدم الـ RPC، غير مستخدم حالياً في الواجهة)

#### `useOrders.js`
- `useOrders(branchId, initialOrders?)` — لو وصلت `initialOrders` (من `useBranch`) تُستخدم كبذرة مباشرة بدل جلب منفصل؛ غير ذلك يجلب بنفسه
- يجلب الطلبات بحالة `preparing` أو `ready` للفرع
- **Realtime Subscription** عبر `postgres_changes`:
  - `INSERT` → يضيف الطلب ويرفع `newOrderFlag`
  - `UPDATE` → يحدّث الطلب
  - `DELETE` → يزيل الطلب
- يرجع: `{ orders, preparing, ready, newOrderFlag, refetch }`

#### `useScanner.js`
- Cooldown: 2000ms بين كل مسح
- يستخدم `parseQR()` ثم يبحث عن الطلب
- **First scan:** INSERT order + scan_log
- **Second scan:** UPDATE order to ready + scan_log
- **Already done:** يعرض رسالة
- يرجع: `{ handleScan, lastResult, clearResult, scanning, history }`
- `history` يحفظ آخر 10 عمليات مسح

#### `useHeartbeat.js`
- يرسل heartbeat كل 30 ثانية لتتبع الحضور
- يحدّث الصفحة الحالية في active_sessions table
- يعمل تلقائياً في ProtectedRoute لجميع المستخدمين
- يستخدم `rpc_upsert_heartbeat` RPC function

#### `useSound.js`
- يستخدم Web Audio API
- يحمّل `/notification.mp3` lazily
- يرجع: `{ play, loadSound }`

#### `useAdminBranch.js`
- يحفظ "الفرع المختار من الأدمن" في `localStorage` (`kz_admin_branch`) ليبقى ثابتاً بين الصفحات
- يرجع: `{ branchCode, selectBranch }`
- يُستخدم في `AdminSidebar.jsx` لحل مشكلة "تعلّق" الفرع (راجع سجل التغييرات 2026-07-11)

---

### 8.5 Context

#### `AuthContext.jsx`
- يدير الجلسة في `localStorage` بمفتاح `kz_session`
- بنية الجلسة: `{ sessionId, userId, username, branch, branchCode, branchId, route, role }`
- `login(username, password)` → يستدعي `authenticate_user` RPC → يحفظ الجلسة → يعيد التوجيه حسب `route`
- `logout()` → يحذف الحضور من active_sessions → يمسح الجلسة → يوجه لـ `/login`
- `getDefaultRoute()` → يحسب المسار الافتراضي حسب `route` + `branchCode`
- مزامنة بين التابات عبر `storage` event
- session validity: **الجلسة لا تنتهي أبداً** — تبقى حتى يسجّل المستخدم الخروج بنفسه (لا يوجد idle timeout)

---

### 8.6 Components

#### `BranchSelector.jsx`
- قائمة منسدلة للفروع النشطة
- Props: `value`, `onChange`, `includeAll` (إضافة خيار "جميع الفروع")

#### `OrderCard.jsx`
- يعرض بطاقة الطلب مع رقم الطلب وقناة التوصيل وزمن الانتظار
- يحدث الزمن كل 10 ثوانٍ
- Props: `order`, `fading`

#### `PreparingColumn.jsx`
- عمود "قيد التحضير" مع عدد الطلبات (🔥)
- Props: `orders`

#### `ReadyColumn.jsx` + `ReadyColumn.css`
- عمود "جاهز" مع dots animation
- Props: `orders`, `fadingOrders`
- يدعم `fading` animation للطلبات التي يتم إكمالها

#### `ScannerView.jsx`
- يستخدم `Html5Qrcode` لفتح الكاميرا
- props: `{ fps: 10, qrbox: 250x250 }`
- Props: `onScan`, `enabled`
- يعرض أركان QR مزخرفة + خط scan متحرك

#### `ProtectedRoute.jsx`
- يتحقق من `isAuthenticated` → إذا لا → يوجه لـ `/login`
- يتحقق من `allowedRoles` → إذا الدور غير مسموح → يوجه للمسار الافتراضي
- يفعّل `useHeartbeat` لتتبع الحضور (heartbeat كل 30 ثانية)

#### `LogoutButton.jsx`
- زر تسجيل خروج بتصميم متوافق مع الثيم
- يستخدم `useAuth().logout()`
- يظهر في headers الصفحات (Scanner, Analytics, Admin, AddUser)

#### `StatsCard.jsx`
- بطاقة إحصائية بسيطة
- Props: `label`, `value`, `unit`, `color`

#### `AppLogo.jsx`
- لوجو كبة زون ثابت (`position: fixed`) أعلى يسار الشاشة
- يظهر في كل الصفحات (مُركّب عالمياً في `App.jsx`)

#### `AdminSidebar.jsx`
- شريط جانبي منزلق من اليمين، يظهر فقط لـ `role: admin`
- روابط: التحليلات، شاشة المطبخ، شاشة العرض، إدارة الفروع، إدارة المستخدمين، سجل النظام + زر خروج
- (رابط "ماسح الطلبات" `/scan` معطّل/مُعلّق حالياً في الكود)
- زر toggle ثابت أعلى اليمين + overlay عند الفتح
- الروابط التي تحتاج فرع (`needsBranch`) تضيف `?branch=CODE` تلقائياً
- **قائمة "الفرع الحالي" في هيدر القائمة** (تحت اسم المستخدم): تعرض كل الفروع النشطة وتستخدم `useAdminBranch` (localStorage) لحفظ اختيار الأدمن بين الصفحات. تغيير الفرع من هنا يحدّث فوراً `?branch=` لو الأدمن واقف على `/kitchen` أو `/display` (بلا تنقّل)، ويضبط الفرع المستخدم في روابط `needsBranch` القادمة. يحل مشكلة كان الفرع فيها "يعلق" بعد أول اختيار حتى يزور صفحة بلا فرع (مثل التحليلات) ويرجع. تستخدم مكوّن `Dropdown` الموحّد (وليس `<select>` افتراضي).

#### `UserSidebar.jsx`
- شريط جانبي للمستخدم العادي (`role: user`) — يحتوي شاشة المطبخ + تسجيل الخروج

#### `LoadingScreen.jsx` + `LoadingScreen.css`
- شاشة تحميل بلوجو متحرك (bounce animation) + ظل
- Props: `text` (افتراضي "جاري التحميل...")، `fullScreen`

---

### 8.7 Pages

#### `DisplayDashboard.jsx` (شاشة العرض)
- **URL:** `/display?branch=CODE`
- إذا لم يحدد فرع → يعرض `BranchSelect`
- يعرض:
  - Header: اسم الفرع + لوجو + ساعة/تاريخ + زر الصوت + عدد الطلبات النشطة
  - **شبكة موحّدة `disp-grid`** بحالتين فقط: **جاهز (أولوية أولى) ثم قيد التحضير**.
  - قسم "تم تسليمها" المطوي (`DeliveredColumn`) + حالة فارغة.
- **DisplayCard (مكوّن داخلي مبسّط):** بادج الحالة العلوي + لوجو التطبيق **بلا صندوق** + رقم الطلب **فقط** — بلا كلمة "طلب"، بلا زر، بلا نوع الطلب، بلا اسم التطبيق، بلا عدّاد وقت. قيد التحضير = لون التطبيق + بادج أصفر؛ جاهز = أزرق + بادج أزرق.
- **تخطيط الشبكة (الحالي = تصميم مربّع رأسي):** الكرت **رأسي** (`flex-direction: column`) — لوجو كبير يملأ عرض الكرت فوق + رقم الطلب تحت، و**12 طلب في الصف** (`repeat(12,1fr)`). هيدر مضغوط + ساعة بالأرقام الإنجليزية (`formatClock` بلا AM/PM). لوجو كبة زون الثابت (`AppLogo`) يصغُر/يرتفع على مسار `/display` فقط.
- **نسختان محفوظتان في scratchpad للتبديل بينهما:** `DisplayDashboard.design1.css` = **المربّع الرأسي 12/صف (الحالي)**؛ `DisplayDashboard.design2-rectangle.css` = **المستطيل الأفقي 10/صف** (لوجو صغير 46px يمين + رقم كبير شمال بالعرض). التبديل = نسخ ملف الـ CSS المطلوب فوق `DisplayDashboard.css` (تعديل CSS فقط، الـ JSX مشترك).
- **Auto-complete:** الطلبات الجاهزة (qr فقط، ليس foodics) تكتمل تلقائياً بعد `VITE_READY_TIMEOUT_MINUTES` (مع `disp-card--fading`).
- **صوت الإشعار:** عند دخول طلب جديد لـ "قيد التحضير".
- **الفلترة:** `isDeliveryAppOrder` يخفي غير-التوصيل ما لم يُفعّل `showAll` (متزامن مع شاشة الفرع).
- **ملاحظة:** `PreparingColumn`/`ReadyColumn` لم تعد مستخدمة (استُبدلت بـ `disp-grid` + `DisplayCard`)؛ `OrderCard` باقٍ لاستخدام `DeliveredColumn` فقط.

#### `Scanner.jsx` (صفحة الماسح)
- **URL:** `/scan?branch=CODE`
- يعرض كاميرا QR مع ScannerView
- عند المسح:
  - Vibrate feedback (200ms)
  - عرض overlay لمدة 3 ثوانٍ مع نوع الإجراء (جديد/جاهز/مكرر/خطأ)
  - مؤشر "جاري المعالجة"
  - سجل آخر عمليات المسح

#### `Analytics.jsx` (التحليلات)
- **URL:** `/analytics`
- **⚡ كل الحساب والفلترة في القاعدة (migration 027) — لا يُجلب كل طلبات الفترة إلى المتصفح إطلاقاً:**
  - **الملخص (KPIs + الرسمان):** `rpc_analytics_summary(p_from, p_branch_id)` — رحلة واحدة ترجع `{total, avg, fastest, slowest, by_branch[{name,avg}], hourly[{hour,count}]}` (تجميع على أعمدة صغيرة مفهرسة، التوزيع الساعي بتوقيت الرياض).
  - **جدول السجل:** تُجلب **الصفحة الظاهرة فقط** (50 صف، `ORDERS_SELECT` بمسارات JSON مسطّحة + `hydrateOrder`) عبر `buildOrdersQuery` + `.range()` + `count: 'exact'`؛ الفلاتر (الحالة/التطبيق/الرقم) شروط SQL: `status`، `delivery_app`، و`or(ilike)` على `app_number`/`foodics_ref`/`foodics_order_number`/`order_id` (أعمدة محسوبة بالـ trigger). حقل الرقم بـ **debounce 400ms** (`numberQuery`).
  - **مصدر التحديث (النظام/فوديكس):** `scan_logs` لصفوف الصفحة الظاهرة فقط (`.in('order_id', ids)`) → `buildSourceMap`.
  - **تصدير Excel:** عند الضغط فقط (`handleExport` + حالة `exporting`) — يجلب كل صفوف الفلترة الحالية على دفعات 1000 (`fetchAllPaged` مع `throwOnError` + تنبيه عند الفشل) + سجلات الفترة، ثم `exportOrdersToExcel`.
- **فلاتر:** الفرع + الفترة (اليوم/7/30) تقود الملخص والجدول؛ الحالة/التطبيق/الرقم تقود الجدول والتصدير. `Dropdown` مخصّصة موحّدة (التطبيق باللوجو)؛ الحالة = الفعّالة فقط.
- KPI Cards: إجمالي الطلبات، متوسط وقت التحضير، أسرع/أبطأ طلب (على `prep_duration_seconds > 0` فقط)
- **Charts (Recharts):** BarChart متوسط التحضير/فرع (بلا فرع محدد: كل الفروع النشطة حتى بمتوسط 0) + AreaChart الطلبات/ساعة
- **جدول السجل (`OrderRow` + `OrdersTableHead`):** أعمدة = التطبيق (لوجو `DeliveryAppLogo` + اسم بلون الهوية عبر `resolveDeliveryApp`) · رقم بالتطبيق (`resolveAppOrderNumber`) · رقم فوديكس (`resolveFoodicsNumber`) · الفرع · الحالة (بادج لكل الحالات) · مصدر التحديث · وقت الطلب · وقت الجاهزية · مدة التحضير

#### `Admin.jsx` (إدارة الفروع)
- **URL:** `/admin`
- CRUD للفروع:
  - إضافة/تعديل فرع (name_ar, name_en, code, location_label)
  - تفعيل/تعطيل فرع
- يعرض جدول الفروع + حالتها
- يعرض روابط الفروع النشطة (`/display?branch=` و `/scan?branch=`)

#### `Kitchen.jsx` (شاشة الفرع)
- **URL:** `/kitchen?branch=CODE`
- إذا لم يحدد فرع → يعرض `BranchSelect target="kitchen"`
- **Header مبسّط:** اسم الفرع فقط + شيك بوكس "إظهار كل الطلبات على شاشة العرض" (بلا لوجو/ساعة/عدّادات).
- **قسم واحد "الطلبات النشطة"** يجمع كل البطاقات بأولوية: قيد التحضير أولاً ثم الجاهز.
- **بادج حالة ملصق أعلى كل بطاقة:** قيد التحضير = أصفر، جاهز = أزرق، تم الاستلام = أخضر.
- **ألوان البطاقة حسب الحالة:** قيد التحضير = لون تطبيق التوصيل (inline)، جاهز = أزرق، تم الاستلام = أخضر (CSS class `kitchen-card--{mode}`).
- **الأزرار = لون الحالة التالية:** قيد التحضير زر "جهز" (أزرق، action `ready`)؛ جاهز زر "تم التسليم" (أخضر، action `delivered`)؛ تم الاستلام بلا زر.
- **قسم "تم الاستلام"** مطوي يظهر/يختفي عبر شيك بوكس (state محلي `showDelivered`) — يعرض `delivered` من `useOrders`.
- **KitchenCard:** **مطابق لكرت شاشة العرض (`DisplayCard`) بالظبط** — بادج الحالة + لوجو التطبيق يملأ عرض الكرت (بلا صندوق، size `lg`) + رقم العرض الكبير (`resolveDisplayNumber`، 3rem) — **ثم زر الإجراء** (الفرق الوحيد عن شاشة العرض). **بلا نوع الطلب / اسم التطبيق (pill) / عدّاد الوقت.**
- **Confirmation Modal:** يستدعي Edge Function `foodics-update-status` (action `ready`/`delivered`)؛ الانتقال بين الأقسام تلقائي عبر Realtime.
- **🗑️ سلة الحذف (تحويل جماعي):** زر سلة أحمر (`.kt-bulk-btn`) في الهيدر بجوار قائمة شاشة العرض — يفتح مودال بـ3 خيارات (كل خيار بعدّاد، ويتعطّل لو العدد 0): تحويل "قيد التحضير" / "الجاهز" / الاثنين معاً إلى **تم الاستلام**، ثم خطوة تأكيد. يستدعي `foodics-update-status` بـ `action: 'bulk_delivered'` + `branch_id` + `scope` (`preparing`/`ready`/`both`) → RPC `rpc_kitchen_bulk_deliver` تحوّل الدفعة محلياً (completed) فينعكس فوراً على شاشتي الفرع والعرض عبر Realtime، ثم الـ Edge Function تزامن فوديكس (PUT delivery_status=5) لكل طلب على دفعات وترفع `synced_to_foodics` للناجح. بعد النجاح يُستدعى `refetch()` كضمان إضافي للدفعات الكبيرة.
- **Responsive:** grid `auto-fill minmax(190px,1fr)` (210px ≥1200px)؛ عمودان على ≤768px، عمود واحد ≤380px.
- **Error state:** يعيد استخدام CSS classes من DisplayDashboard.css

#### `Login.jsx` (تسجيل الدخول)
- **URL:** `/login`
- حقلين: username + password (dir=ltr)
- إذا مسجّل دخول بالفعل → يوجه للمسار الافتراضي
- يستدعي `login()` من AuthContext
- يعرض رسالة خطأ عند فشل الدخول
- تصميم: بطاقة مركزية على خلفية داكنة

#### `AddUser.jsx` (إدارة المستخدمين)
- **URL:** `/add-user` (admin فقط)
- فورم إضافة/تعديل: username, password (اختياري عند التعديل), branch (dropdown), role, route
- جدول المستخدمين الحاليين مع إمكانية التعديل والحذف
- يستخدم RPC functions: `create_user`, `list_users`, `delete_user`, `update_user_secure`
- الأدمن لا يمكنه حذف حسابه
- زرار "تعديل" يملأ الفورم ببيانات المستخدم + زرار "إلغاء التعديل" للرجوع

#### `Logs.jsx` (سجل النظام)
- **URL:** `/logs` (admin فقط)
- يعرض المستخدمين المتصلين حالياً (online users)
- يحدّث تلقائياً كل 30 ثانية
- يعرض: اسم المستخدم، الدور، الفرع، الصفحة الحالية، آخر نشاط
- يستخدم `rpc_get_online_users` RPC function
- يعرض حالة فارغة عند عدم وجود مستخدمين متصلين

> (انظر القسم الأحدث أعلاه لتفاصيل `Kitchen.jsx` بعد إعادة التصميم — قسم "الطلبات النشطة" الموحّد + بادجات الحالة + قسم "تم الاستلام" المطوي.)

#### `BranchSelect.jsx` (اختيار الفرع)
- يظهر عند الدخول على `/display` أو `/scan` أو `/kitchen` بدون `?branch=`
- يعرض قائمة بطاقات الفروع النشطة
- عند الضغط يوجه للصفحة المناسبة مع `?branch=CODE`

---

## 9. الألوان الرئيسية (Design Tokens) — هوية Foodics

```css
--kz-primary:      #440099    /* بنفسجي Foodics الأساسي */
--kz-primary-light: #6622cc   /* بنفسجي فاتح */
--kz-dark:         #13102a    /* الخلفية الرئيسية */
--kz-dark-lighter: #1e1a35    /* خلفية أفتح */
--kz-dark-card:    #22203d    /* خلفية البطاقات */
--kz-cream:        #f8f8fa    /* رمادي فاتح */
--kz-red:          #ce0b0b    /* أحمر (أخطاء) */
--kz-gold:         #f7941d    /* ذهبي */
--kz-text:         #55536a    /* نص رئيسي */
--kz-text-light:   #8886a0    /* نص ثانوي */
--kz-green:        #22c55e    /* أخضر (جاهز) */
--kz-green-dark:   #16a34a    /* أخضر غامق */
border-color:      #35305a    /* حدود البطاقات */
```

---

## 10. PWA (Progressive Web App)

- **Service Worker:** `public/sw.js` — Network-first مع cache fallback
- **Manifest:** `public/manifest.json` — `display: standalone`, `start_url: /scan`
- **صوت الإشعار:** `public/notification.mp3`

---

## 11. أوامر التشغيل

```bash
npm run dev       # تشغيل بيئة التطوير
npm run build     # بناء الإنتاج
npm run preview   # معاينة البناء
npm run lint      # فحص الكود
```

---

## 12. ملاحظات مهمة للتطوير

1. **Realtime:** مفعّل فقط على جدول `orders` عبر `ALTER PUBLICATION supabase_realtime ADD TABLE orders`
2. **RLS:** سياسات مفتوحة (MVP) — جميع العمليات مسموحة للـ anon
3. **الخط:** Tajawal من Google Fonts، يتم تحميله في `index.html`
4. **الاتجاه:** RTL — `<html lang="ar" dir="rtl">`
5. **QR Format:** يدعم JSON أو نص عادي
6. **Cooldown:** 2 ثوانية بين كل عملية مسح
7. **Auto-complete:** الطلبات الجاهزة تكتمل تلقائياً بعد 5 دقائق (قابل للتعديل)
8. **كل صفحة لها ملف CSS مستقل** بالإضافة لـ TailwindCSS
9. **Authentication:** نظام مصادقة مبني على Supabase DB (ليس Supabase Auth) — bcrypt hashing + RPC functions + RLS
10. **الفرع يُحدد عبر query param** `?branch=CODE`
11. **الأدوار:** admin (كل الصلاحيات)، user (scan فقط)، screen (display فقط)
12. **Session:** يحفظ في localStorage — لا ينتهي أبداً لأي دور، يبقى المستخدم مسجلاً حتى يضغط تسجيل الخروج بنفسه

---

## 13. سجل التغييرات

| التاريخ | الوصف |
|---------|-------|
| 2026-07-12 | **📺 توجل إظهار/إخفاء هيدر شاشة العرض من شاشة الفرع (يتزامن realtime).** حسب الطلب: توجل جديد "الهيدر" (`.kt-header-toggle` — سويتش iOS) في هيدر شاشة الفرع بجوار dropdown وضع شاشة العرض: مفعّل (افتراضي) = هيدر شاشة العرض (الساعة/اسم الفرع/عداد الطلبات النشطة/زر الصوت) ظاهر؛ مطفأ = الهيدر مخفي بالكامل وتتمدد شبكة الطلبات مكانه. **Backend:** migration **`031_display_header_toggle.sql`** — عمود `show_header BOOLEAN DEFAULT true` على `branch_settings` + تحديث `rpc_branch_bootstrap` ليُرجعه ضمن `display_setting`. **الـ hook** `useBranchDisplaySetting` أضاف `showHeader` + `setShowHeader` (قراءة + bootstrap seed + realtime + upsert تفاؤلي — نفس نمط `displayMode`). **`DisplayDashboard`:** الهيدر ملفوف بـ `{showHeader && ...}`. ملاحظة: إخفاء الهيدر يخفي معه زر الصوت — الصوت يظل شغالاً على حالته الأخيرة (افتراضي مفعّل). **⚠️ نشر:** طبّق `031` على قاعدتي التيست والبرود قبل نشر الواجهة (الواجهة تتحمّل غيابه — fallback إلى true — لكن الحفظ من التوجل يحتاج العمود). |
| 2026-07-12 | **🐛 هيدر صفحة التحليلات صار ثابتاً بالكامل أثناء السكرول (تعديل ثانٍ بعد بلاغ المستخدم إن الفيكس الأول ماكانش كافي).** الفيكس الأول (`min-height` بدل `height:100vh; overflow-y:auto` على `.analytics-root`) ثبّت اللوجو وزر السايدبار فعلاً (اتأكد بمتصفح حقيقي عبر Playwright)، لكن ده كشف مشكلة تصميم أعمق: `.page-header` (العنوان + الفلاتر + زر تصدير Excel) كان مصمَّم عمداً (`position: relative`) ليطلع لفوق ويختفي مع السكرول — فكان يفضل بس اللوجو والزر عائمين لوحدهم فوق المحتوى بلا خلفية الهيدر، شكل بايظ بصرياً واللي المستخدم قصده بـ"مش ثابتين في الهيدر". **الحل:** `.page-header` صار `position: sticky; top: 0` بدل `relative` في `Analytics.css` — الهيدر بالكامل (اللوجو + الزر + العنوان + الفلاتر + تصدير Excel) يفضل ظاهر ثابت أعلى الشاشة أثناء السكرول بدل ما يختفي. اتأكد بـ Playwright: سكرين شوت بعد سكرول 800px يوضح الهيدر كامل لسه ظاهر بالضبط زي حالة أعلى الصفحة. ✅ lint نظيف + build ناجح. |
| 2026-07-12 | **🔎 تفصيل مكوّنات المنتج + إعادة تصميم سكشن الأكثر مبيعاً.** ملاحظتان من صاحب المشروع: (١) أسماء البوكسات غامضة ("بوكس مشكل 3" لا يوضّح المحتوى)، (٢) التصميم بايظ (شارت Recharts الأفقي كان يقصّ الأسماء العربية الطويلة ويركّبها فوق البارات). **الحل — migration `030_top_products_modifiers.sql`:** أُضيف عمود `modifiers` لـ `order_items` (أسماء `products[].options[].modifier_option.name` مرتّبة، مفصولة بـ "، "، مع "×N" للكمية>1)؛ حُدّثت `kz_sync_order_items` + أُعيد backfill؛ و`rpc_top_products` صارت **تجمّع على (product_id + modifiers)** وترجع `name` و`modifiers` منفصلين (قرار: "البوكس بتركيبته الكاملة" — كل تركيبة صف مستقل). **الواجهة:** استُبدل شارت Recharts الأفقي بمكوّن **`RankList`** (بارات CSS، تقرأ صح RTL، سطران: المنتج + تفصيل المكوّنات تحته بلون `--accent-light`) — أنظف مع الأسماء الطويلة؛ وأضيف تفصيل المكوّنات لكروت "أعلى منتج لكل فرع" (`.branch-top-modifiers`). أنماط `.rank-*` في `Analytics.css` (بادج ذهبي/فضّي/برونزي لأول ٣). ملاحظة: migration 029 كان مطبّقاً فعلاً فأُنشئ 030 مكمّلاً بدل تعديله. ✅ lint نظيف + build ناجح. |
| 2026-07-12 | **🏆 سكشن "أعلى المنتجات مبيعاً" في صفحة التحليلات (`Analytics.jsx`) — إجمالاً + لكل فرع.** المطلوب: تحليل المنتج الأكثر مبيعاً على كل الفروع مرتّباً، وأعلى منتج في كل فرع، من طلبات فوديكس (تطبيقات + POS). **مصدر البيانات:** المنتجات تعيش داخل `raw_qr_data.foodics_order.products[]` (لكل عنصر: `.product.id/.name/.name_localized/.category.name` + `.quantity/.returned_quantity/.unit_price/.total_price`). **قرار معماري:** عمل `unnest` حيّ على raw_qr_data لآلاف الطلبات = يعيد انهيار statement_timeout 57014 المُعالَج في migration 027 — لذا **migration `029_top_products.sql`** يضيف جدولاً مسطّحاً مفهرساً **`order_items`** يُملأ عبر **trigger `orders_sync_items`** (AFTER INSERT/UPDATE OF raw_qr_data — حذف ثم إدراج) + **backfill** للموجود، ودالة **`kz_sync_order_items`** للاستخراج. **RPC `rpc_top_products(p_from, p_branch_id, p_limit)`** ترجع `{overall:[{name,qty,revenue}], by_branch:[{branch,name,qty,revenue}]}` — الكمية = `quantity - returned_quantity`، القيمة = `total_price`، تستبعد `status='cancelled'`، منتجات أساسية فقط (تتجاهل `options[]` و`combos[]`). **الواجهة:** شارت أفقي "أعلى 10 (بالكمية)" + شبكة كروت "أعلى منتج لكل فرع" (`.products-grid`/`.branch-top-*` في `Analytics.css`) — يتبعان فلتري الفترة والفرع. **شارت "قيمة المبيعات (بالفلوس)" مخفي بالكود** عبر ثابت `SHOW_REVENUE_PRODUCTS_CHART=false` (البيانات مجلوبة أصلاً؛ يظهر بتغيير الثابت إلى true). ✅ lint نظيف + build ناجح. |
| 2026-07-12 | **🎨 توحيد قائمة "الفرع الحالي" في `AdminSidebar` مع تصميم القوائم المنسدلة المستخدم في باقي النظام.** كانت القائمة `<select>` افتراضي بستايل مضمّن مختلف عن شكل الـ dropdown المستخدم في التحليلات (فلاتر الفرع/التطبيق). **الحل:** استُخرج مكوّن `Dropdown` (كان معرّفاً محلياً داخل `Analytics.jsx`) إلى مكوّن مشترك **`components/Dropdown.jsx` + `Dropdown.css`** (نفس البنية والألوان: بنفسجي `#5830C5`، حدود `#e5e7eb`، Tajawal، `border-radius` 12-14px، أنيميشن فتح `ddIn`) — متغيرات CSS محلية (`--dd-*`) بدل الاعتماد على `.analytics-root` ليعمل في أي مكان. **`AdminSidebar.jsx`:** استُبدل `<select>` بـ `<Dropdown value={branchCode} onChange={...} options={branches.map(b => ({value:b.code,label:b.name_ar}))} />` (توقيع `handleBranchChange` صار يستقبل الكود مباشرة بدل event). `Analytics.jsx` لم يُعدَّل (لا يزال بنسخته المحلية). ✅ lint نظيف. |
| 2026-07-11 | **🚨 إصلاح جذري لانهيار صفحة التحليلات على البرودكشن (57014 statement timeout ⇒ 500 ⇒ أصفار).** **السبب الجذري:** الصفحة كانت تجلب *كل* طلبات الفترة (+6000 وتتزايد آلافاً يومياً) عبر `fetchAllPaged` لتحسب KPIs/الرسوم/الفلترة محلياً — بلا فهرس على `created_at` وحده فكل صفحة offset تعيد فحص/فرز الجدول كاملاً + استخراج ~11 مسار JSON من `raw_qr_data` الضخم (detoast) لآلاف الصفوف ⇒ تجاوز `statement_timeout` (8 ثوانٍ للـ anon) ⇒ خطأ 57014 يبتلعه `fetchAllPaged` بصمت. **الحل (يُحسب عند الكتابة ويُجمَّع في القاعدة):** migration **`027_analytics_server_side.sql`** — (أ) أعمدة محسوبة على `orders`: `delivery_app`/`app_number`/`foodics_ref` يملؤها trigger `orders_analytics_fields` (دوال `kz_resolve_delivery_app`/`kz_extract_app_number` بمنطق مطابق لـ `deliveryApps.js`) + backfill؛ (ب) فهارس `idx_orders_created_at`، `idx_orders_branch_created`، `idx_scan_logs_order_id`، `idx_scan_logs_scanned_at`؛ (ج) RPC **`rpc_analytics_summary(p_from, p_branch_id)`** ترجع `{total, avg, fastest, slowest, by_branch[], hourly[]}` في رحلة واحدة (بلا JSONB، توقيت الرياض للساعات). **`Analytics.jsx`:** الملخص من الـ RPC؛ الجدول صفحة-بصفحة (50 صف) بفلاتر SQL (`buildOrdersQuery`: status/delivery_app/or-ilike على أعمدة الأرقام) + `count: 'exact'` + debounce 400ms لحقل الرقم + إلغاء الاستجابات المتأخرة (cancelled flag)؛ `scan_logs` لصفوف الصفحة فقط؛ **التصدير عند الطلب** على دفعات 1000 (كل دفعة استعلام مستقل سريع) مع `throwOnError` جديد في `fetchAllPaged` (يرمي بدل ملف ناقص بصمت) وزر "جاري التصدير...". النتيجة: التحميل من ~ميجابايتات + timeout إلى 3 طلبات صغيرة (ملخص + 50 صف + مصادرها) بأجزاء الثانية، ويتحمّل النمو لعشرات آلاف الطلبات. ✅ lint + build نظيف. **⚠️ نشر: طبّق `027` على قاعدتي التيست والبرود قبل نشر الواجهة** (الواجهة الجديدة تعتمد على الأعمدة والـ RPC). |
| 2026-07-03 | **🗑️ سلة الحذف في هيدر شاشة الفرع — تحويل جماعي إلى "تم الاستلام" (3 نطاقات).** حسب الطلب: زر سلة أحمر (`.kt-bulk-btn`) في هيدر `Kitchen` بجوار dropdown شاشة العرض → مودال بـ**3 خيارات** بعدّادات (يتعطّل الخيار لو عدّاده 0): تحويل **"قيد التحضير"** / **"الجاهز"** / **الاثنين معاً** إلى تم الاستلام، ثم **خطوة تأكيد** (عدد الطلبات + تنبيه أنها ستختفي من الشاشتين وتُزامَن لفوديكس). **Backend:** migration **`023_bulk_deliver.sql`** — RPC `rpc_kitchen_bulk_deliver(p_session_id, p_branch_id, p_scope, p_device_info)` (SECURITY DEFINER، أدوار admin/user): تحوّل دفعة واحدة (atomic CTE) كل طلبات الفرع المطابقة للنطاق إلى `completed` (+`delivered_at`/`completed_at`/`ready_at` إن كانت فارغة/`foodics_delivery_status=5`/`synced_to_foodics=false`) + `scan_logs('delivered')` لكل طلب، وترجع `{count, orders[{id,source,foodics_order_id}]}`. **Edge Function `foodics-update-status`:** action جديد **`bulk_delivered`** (body: `session_id, branch_id, scope`) — ينفّذ الـ RPC أولاً (المحلي فوري ⇒ الشاشتان تتحدثان عبر Realtime) ثم `PUT delivery_status=5` لفوديكس لكل طلب foodics **على دفعات من 5**، ويرفع `synced_to_foodics=true` للناجح فقط (فشل فوديكس لا يوقف العملية — نفس القاعدة). **الواجهة:** `Kitchen.jsx` (state `bulkOpen`/`bulkScope`/`bulkWorking` + `handleBulkConfirm` + `refetch()` بعد النجاح كضمان للدفعات الكبيرة) + أنماط `Kitchen.css` (`.kt-hdr-actions`/`.kt-bulk-btn`/`.kitchen-bulk-option*` + جوال). **شاشة العرض بلا تعديل** — تنعكس تلقائياً لأن الحالة تتغير في القاعدة. ✅ lint + build نظيف. **⚠️ نشر:** طبّق `023_bulk_deliver.sql` + أعد نشر `foodics-update-status` على مشروعي التيست + البرود. |
| 2026-07-01 | **🎴 توحيد كرت شاشة الفرع (`KitchenCard`) ليطابق كرت شاشة العرض (`DisplayCard`) بالظبط + أزرار الإجراء.** حسب الطلب: صار كرت شاشة الفرع بنفس تصميم كرت شاشة العرض تماماً — بادج الحالة أعلى الكرت + **لوجو التطبيق يملأ عرض الكرت** (بلا صندوق: `.kitchen-card-logo .app-logo { width:100%; aspect-ratio:1/1; background/border/box-shadow:none }` + `.app-logo-img{padding:0}`، size `md`→`lg`) + **رقم كبير في المنتصف** (`2.1rem`→`3rem`) + `border-radius 14px`→`18px` و`padding`/`gap`/بادج مطابقة لـ `disp-card`. **الفرق الوحيد = زر الإجراء أسفل الكرت** (قيد التحضير→"جهز" أزرق، جاهز→"تم التسليم" أخضر). **إزالة من `KitchenCard`:** صف نوع الطلب + اسم التطبيق (`kitchen-card-tags`/`kitchen-card-type`) + كلمة "طلب" (`kitchen-card-order-lbl`) + **عدّاد الوقت** (`kitchen-card-time` + منطق `formatElapsed`/`useEffect`) — وحُذفت أنماطها + الاستيرادات غير المستخدمة (`useEffect`, `formatElapsed`, `DeliveryAppPill`, `ORDER_TYPE_LABELS`). تحديث قواعد الجوال (حذف override اللوجو الثابت 50px + أنماط التاجات، الرقم `1.7rem`→`2.2rem`). **تعديل `Kitchen.jsx` + `Kitchen.css` فقط — بلا مسّ لشاشة العرض/الـ hooks/DB.** ✅ lint + build نظيف. |
| 2026-07-01 | **⚡ إصلاح جذري لبطء تحميل شاشتي الفرع والعرض — View خفيف بـ `raw_qr_data` مُقلّم + جلب متوازٍ + فهارس.** **السبب الجذري:** `useOrders` كان `select('*')` على `orders` فيجرّ عمود `raw_qr_data` (JSONB = payload فوديكس الخام الكامل: items/products/customer/payments...) لكل طلب، ومع تراكم مئات/آلاف الطلبات النشطة (فوديكس لا يُغلقها تلقائياً) ⇒ ميجابايتات تُنقل وتُحلَّل ⇒ بطء شديد، رغم أن الواجهة تقرأ فقط حقولاً نصية صغيرة (`meta.external_number`/`app_id`/`aggregator`...). **الحل:** migration **`025_orders_display_view.sql`** — view `v_orders_display` يُرجع نفس أعمدة `orders` لكن `raw_qr_data` **مُقلّم** لِما يقرأه `deliveryApps.js` فقط: `foodics_order.{app_id, meta(channelLink+external_number فقط), aggregator, delivery(aggregator.name فقط), delivery_company, customer.name, tags, reference, reference_x}` عبر `jsonb_build_object`، فيحذف المصفوفات الضخمة (products/payments/…) و**bloat الـ `meta`** (`receipt_qr` base64 + `products_kitchen`) **دون تغيير شكل البيانات** ⇒ كود الواجهة بلا تعديل. **تأكيد الأسماء:** روجعت مقابل payload فوديكس حقيقي + `foodics-webhook/index.ts` (السطر `raw_qr_data: { foodics_order: order }`) — المسار والأسماء مطابقة. + `GRANT SELECT` لـ anon/authenticated + فهرسان (`branch_id,status,created_at` و partial على `completed`). **`useOrders`:** القراءة من `v_orders_display` بدل `orders`، واستعلاما النشط/المكتمل صارا **بالتوازي (`Promise.all`)** بدل تتابع. الـ Realtime يبقى على جدول `orders` (صفوف مفردة، والـ resolve يقرأ نفس الحقول). النتيجة: payload أخف 80–95%. ✅ lint + build نظيف. **⚠️ نشر:** طبّق `025` على التيست + البرود (يُنشئ الـ view والفهارس). *(اختياري لاحقاً: توجيه `Analytics.jsx` لنفس الـ view.)* |
| 2026-07-01 | **📺 قائمة اختيار وضع شاشة العرض (dropdown) في هيدر شاشة الفرع + وضع "العمودين" (جاهز \| قيد التجهيز).** استُبدل مفتاح "إظهار الكل بالعرض" (التوجل القديم) بـ**dropdown** (`.kt-display-select`) في هيدر شاشة الفرع فيه 4 أوضاع تتحكم في **شاشة العرض** وتتزامن realtime: **الكل** / **الجاهز** / **النشط** (=قيد التجهيز) / **النشط + الجاهز (عمودين)**. **التخزين:** migration **`024_branch_display_mode.sql`** — عمود `display_mode TEXT default 'all' CHECK(all/ready/preparing/split)` على `branch_settings`. **الـ hook** `useBranchDisplaySetting` أضاف `displayMode` + `setDisplayMode` (قراءة + realtime + upsert). **`DisplayDashboard`** يفرّع على `displayMode`: `ready`/`preparing`=شبكة موحّدة مفلترة، `all`=السلوك السابق (+قسم تم التسليم يظهر في `all` فقط)، **`split`=عمودان** (`.disp-split`): **يمين "جاهز" + يسار "قيد التجهيز"**، كل عمود شبكة **7/صف** (`.disp-grid--split`؛ تابلت 4/صف، جوال عمودان فوق بعض). **ملاحظة:** فلتر التوصيل القديم (`show_all_on_display`) لم يعد له UI — ثُبّت على سلوكه الافتراضي (توصيل فقط) وبقيت البنية في الـ hook/DB. **إزالة:** تابات الفلتر المحلية القديمة على شاشة الفرع (`.kt-tabs`) ما زالت كما هي (فلتر محلي منفصل). ✅ lint + build نظيف. **⚠️ نشر:** طبّق `024` على قواعد التيست + البرود. |
| 2026-07-01 | **🎨 إعادة تصميم هيدر شاشة الفرع (`Kitchen`) — براند + حالة "متصل الآن" + سويتش شاشة العرض + تابات فلترة (segmented).** استُبدلت شيك بوكسات الفلتر بـ**تابات** (`.kt-tabs`): **النشطة** (بعدّاد قيد التحضير+جاهز) / **الجاهزة** (بعدّاد الجاهز) / **الكل**، بنمط segmented-control (تاب نشط بخلفية `--accent` البنفسجي). الهيدر صار عمودين: صف علوي **براند** (لوجو حرفين + اسم الفرع + مؤشّر "متصل الآن" أخضر نابض) يميناً + **سويتش "إظهار الكل بالعرض"** (`.kt-display-switch`، سويتش iOS مدمج بدل الشيك بوكس، نفس `showAll` المتزامن) يساراً؛ ثم صف التابات. **الفلتر محلي لشاشة الفرع فقط** (`filterMode`): "الكل" فوري بلا تأكيد، "النشطة"/"الجاهزة" تفتح نافذة تأكيد (`.kitchen-modal*`) قبل التطبيق. `padding-right:68px` محجوز لزر القائمة العائم (UserSidebar). **CSS:** أُزيلت أنماط `.kitchen-filter-*`/`.kitchen-display-toggle`/`.kitchen-branch-name` القديمة وأُضيفت `.kt-*` + قواعد جوال (الصف العلوي يلتفّ، تصغير اللوجو/الخط). ألوان وخط المشروع (`#5830C5` + Tajawal). **تعديل `Kitchen.jsx`+`Kitchen.css` فقط.** ✅ lint + build نظيف. |
| 2026-07-01 | **☑️ (سابقاً — استُبدل بالتابات أعلاه) زرّا فلترة محلية على شاشة الفرع (`Kitchen`): الكل / النشطة فقط / الجاهزة فقط + نافذة تأكيد + تجاوب جوال.** حسب الطلب: زرّان (`.kitchen-filter-chip` بنمط شيك بوكس) في هيدر **شاشة الفرع** يفلتران **شاشة الفرع نفسها فقط** (فلتر محلي — لا مزامنة، لا قاعدة بيانات، لا علاقة بشاشة العرض). **السلوك:** كلاهما مطفأ = عرض كل الطلبات (النشطة + قسم "تم الاستلام")؛ **"النشطة فقط"** = يخفي قسم تم الاستلام؛ **"الجاهزة فقط"** = يعرض الطلبات الجاهزة فقط (يخفي قيد التحضير + تم الاستلام، والعنوان يصير "الطلبات الجاهزة"). حالة محلية `filterMode ∈ {all,active,ready}` (الزرّان متنافيان). **التأكيد:** نقر زر لتفعيله يفتح `pendingFilter` → نافذة تأكيد (تعيد استخدام `.kitchen-modal*`) ثم `confirmFilter` يطبّق الفلتر؛ نقر زر مفعّل يطفّيه فوراً (رجوع لـ all بلا تأكيد). **CSS:** `.kitchen-header-controls` + `.kitchen-filter-*` جديدة في `Kitchen.css` + قواعد جوال داخل `@media(max-width:768px)` (الأزرار `flex:1` بعرض كامل). **تعديل `Kitchen.jsx` + `Kitchen.css` فقط — بلا مسّ لشاشة العرض/الـ hooks/DB.** ✅ lint + build نظيف. |
| 2026-07-01 | **⚡ تسريع تحميل صفحة التحليلات (كان ~15ث) بتقليل الحمولة + دفعات 1000 + 50/صفحة.** السبب الجذري للبطء: `select('*')` كان يسحب عمود `raw_qr_data` (كامل طلب فوديكس = عدة KB/طلب) لكل الطلبات = ميجابايتات على دفعات 100. **الحل:** (1) ثابت `ORDERS_SELECT` يجلب الأعمدة المطلوبة فقط + مسارات JSON الصغيرة من `raw_qr_data` (app_id/reference/reference_x/meta.external_number/meta.channelLink/aggregator/delivery/customer/tags) كقيَم مسطّحة (`rq_*`)، ثم `hydrateOrder` يعيد بناء الشكل المتداخل `raw_qr_data.foodics_order` فتعمل دوال `resolveDeliveryApp/resolveAppOrderNumber/resolveFoodicsNumber` بلا تغيير. الحمولة تنكمش من ~KB لـ~بايتات/طلب. (2) `FETCH_PAGE=1000` (أقصى دفعة Supabase) لاستعلامي الطلبات و`scan_logs` = أقل round-trips (كان 100). (3) `PAGE_SIZE` صار **50** (كان 100). كل الفلاتر/الإحصائيات/الرسوم/تصدير Excel تظل على كامل السجل. `useOrders` كذلك رُفعت دفعته لـ1000. ✅ lint + build نظيف. |
| 2026-07-01 | **📄 ترقيم صفحات جدول "سجل الطلبات" في التحليلات — 100 طلب/صفحة + أزرار تنقّل.** الجدول صار يعرض 100 طلب فقط في الصفحة مع أزرار "السابق/التالي" و"صفحة X من Y". حالة `page` + ثابت `PAGE_SIZE=100`؛ `pagedOrders = filteredOrders.slice(...)`؛ `currentPage` يُقصَر داخل `totalPages`؛ الرجوع للصفحة 1 تلقائياً عند تغيّر أي فلتر/الفترة/الفرع (`useEffect`). أزرار التنقّل تظهر فقط لو `totalPages>1`، معطّلة عند الحدود. عدّاد `.table-count` يظل يعرض الإجمالي بعد الفلترة. CSS: `.table-pagination`/`.pagination-btn`/`.pagination-info`. (البيانات كاملة تُجلب عبر `fetchAllPaged`، والترقيم هنا للعرض فقط.) ✅ lint + build نظيف. |
| 2026-07-01 | **🐞 إصلاح توقّف عرض/تسجيل الطلبات بعد ~1000 طلب — Pagination على دفعات 100 لتجاوز حد Supabase (Max rows=1000).** السبب: أي `select` بلا `limit`/`range` صريح يُرجِع 1000 صف كحد أقصى (إعداد Supabase الافتراضي)، واستعلام الطلبات النشطة في `useOrders` كان بلا حد، فبمجرد تراكم الطلبات النشطة (طلبات فوديكس لا تُغلق تلقائياً) عند 1000 يقتطع الاستعلام بصمت. **الحل:** دالة `fetchAllPaged(buildQuery, pageSize=100)` في `lib/supabase.js` تجلب كل الصفوف على دفعات عبر `.range()` في حلقة حتى تنتهي (كل طلب ≤100 صف = تحت الحد، والإجمالي غير محدود). طُبّقت على: (1) استعلام الطلبات النشطة في `useOrders.js`. (2) استعلام الطلبات + استعلام `scan_logs` في `Analytics.jsx` (استُبدل `.limit(1000)`). ✅ lint + build نظيف. |
| 2026-07-01 | **↩️ الرجوع لتصميم شاشة العرض المربّع (12/صف) + حفظ نسختي التصميم للتبديل.** بطلب المستخدم: أُعيد `DisplayDashboard.css` للتصميم **المربّع الرأسي (12 طلب/صف، لوجو يملأ العرض)** بنسخ `DisplayDashboard.design1.css` فوقه (build hash تأكّد أنه مطابق للأصل). حُفظت النسختان في scratchpad: **`DisplayDashboard.design1.css` = المربّع 12/صف (الحالي)**، **`DisplayDashboard.design2-rectangle.css` = المستطيل الأفقي 10/صف**. التبديل بينهما = نسخ ملف الـ CSS المطلوب فوق `DisplayDashboard.css` (JSX مشترك، تعديل CSS فقط). ✅ lint + build نظيف. |
| 2026-07-01 | **🔀 تصميم بديل لشاشة العرض (كرت أفقي مستطيل واطي) — 10 طلبات/صف.** حسب الطلب: كرت **أفقي** (`.disp-card { flex-direction: row }`) — **اللوجو صغير يمين (46px) + الرقم كبير شمال بالعرض في سطر واحد** (`.disp-card-order{flex:1}` + `.disp-card-id{white-space:nowrap; clamp 1.3–2.1rem}`؛ أُزيل `overflow-wrap:anywhere` اللي كان بيقسّم الرقم عمودي)، بادينج خفيف جداً (`0.45rem 0.55rem 0.3rem`) ⇒ **ارتفاع الكرت ≈ نص المربع السابق**، شبكة **`repeat(10, minmax(0,1fr))`** (كانت 12). **تعديل CSS فقط** (بلا مسّ للـ JSX — الـ RTL يضع اللوجو يميناً تلقائياً). **نسخة التصميم السابق (الرأسي 12/صف) محفوظة في scratchpad `DisplayDashboard.design1.css/.jsx`.** ✅ lint + build نظيف. |
| 2026-07-01 | **🖥️ ضبط شاشة العرض (`DisplayDashboard`) لعرض التلفاز: 12 طلب/صف + لوجوهات كبيرة بلا صناديق + هيدر مضغوط + ساعة إنجليزية.** حسب طلب العرض: (1) **12 طلب في الصف** — `.disp-grid` صار `repeat(12, minmax(0,1fr))` (كان 7 على ≥1200px) مع gap أصغر (`0.55rem` أفقي)، و`clamp` الرقم صُغِّر (`1.2–2rem`) ليلائم العمود الضيّق. (2) **حذف كلمة "طلب"** من نص الكرت (أُزيل `disp-card-order-lbl` span من `DisplayCard`). (3) **حذف الصندوق حول اللوجو + تكبيره** — override مقيّد `.disp-card-logo .app-logo { width:100%; aspect-ratio:1/1; background/border/box-shadow: none }` + `.app-logo-img{padding:0}` (يخص شاشة العرض فقط، لا يمسّ شاشة الفرع). (4) **تصغير الهيدر لأقصى حد** — تقليل paddings/أحجام `.dash-header-inner`/`.dash-logo`/`.dash-branch-name`/`.dash-clock`/`.dash-sound-toggle` + تقريب `.dash-date`/`.dash-active-status`، وتصغير `.dash-main` العلوي. (5) **الساعة بالإنجليزية** — أُعيدت كتابة `formatClock()` لتبني `HH:MM:SS` (12h، بلا AM/PM) بأرقام لاتينية بدل `toLocaleTimeString('ar-SA')` (يخص شاشة العرض فقط — لا استخدام آخر لها). (6) **`AppLogo`** صار route-aware (`useLocation`) → يصغُر/يرتفع على `/display` فقط. ✅ lint + build نظيف. |
| 2026-06-30 | **🔧 تصحيح: رأس **الجدول** هو الثابت لا هيدر الصفحة.** التعديل السابق ثبّت هيدر الصفحة (filters) بالغلط. الصحيح: **هيدر الصفحة يتمرّر ويختفي**، ورأس الجدول وحده يثبت. `.analytics-root` صار `height:100vh; overflow-y:auto` = منطقة التمرير الوحيدة (أُزيل `display:flex`/`overflow:hidden`)؛ `.page-header` بلا `flex-shrink` (يتمرّر عادي)؛ `.main-content` رجع block عادي. رأس الجدول `position:sticky; top:0` يثبت بالنسبة لـ `.analytics-root` (يعمل بثبات بفضل scroll container صريح + `border-collapse:separate`). اللوجو (fixed خارج analytics-root) يبقى ثابتاً. ✅ lint + build نظيف. |
| 2026-06-30 | **🖥️ تخطيط التحليلات بارتفاع الشاشة (app-shell) — رأس جدول ثابت فعلياً + لوجو/هيدر ثابتان.** المحاولات السابقة لتثبيت رأس الجدول بـ window-sticky فشلت (لا يوجد scroll container، + bug `border-collapse:collapse` مع sticky في بعض المتصفحات) وكان لوجو الصفحة يتمرّر مع المحتوى. **الحل النهائي:** `.analytics-root` صار `height:100vh; overflow:hidden; display:flex; flex-direction:column`؛ `.page-header` `flex-shrink:0` (ثابت أعلى الصفحة)؛ `.main-content` `flex:1; min-height:0; overflow-y:auto` = **منطقة التمرير الوحيدة**، فرأس الجدول `position:sticky; top:0` يثبت بالنسبة إليها بشكل موثوق. الجدول صار `border-collapse:separate; border-spacing:0` لتفادي bug الـ sticky. بما أنه لا يوجد تمرير على مستوى النافذة، **اللوجو (`AppLogo` fixed) والهيدر يبقيان ثابتين**. ✅ lint + build نظيف. |
| 2026-06-30 | **📌 تثبيت رأس جدول التحليلات عند التمرير + إظهار كل الفروع في الشارت.** (1) **رأس الجدول ثابت (sticky) أعلى النافذة:** `.data-table th { position:sticky; top:0; z-index:20; background }`. **هيدر الصفحة صار غير ثابت** (أُزيل `position:sticky` منه) — تثبيت عنصرين معاً كان يجعل رأس الجدول يطفو وسط القائمة. أُزيل `overflow:hidden` من `.table-card` و`overflow-x:auto` من `.table-wrapper` (صارت `visible` على الديسكتوب، `auto` على الجوال ≤768px) لأنهما يكسران sticky بالنسبة للنافذة. (2) **شارت "متوسط وقت التحضير لكل فرع" يعرض كل الفروع:** كان يُسقط أي فرع بلا طلبات مكتملة في الفترة (٩ من ١٠)؛ صار `branchChartData` يُمهّد الخريطة بكل الفروع من `branches` (متوسط=0 للفارغ) عند عدم تحديد فرع. ✅ lint + build نظيف. |
| 2026-06-30 | **🧹 تبسيط رأس التحليلات: بحث واحد + توحيد قائمة الفرع + تصغير الهيدر.** (1) **حذف البحث المكرّر:** أُزيل شريط البحث العلوي (`order-search-bar`) وجدول نتائجه المنفصل + كل state/handlers (`searchQuery`/`searchResult`/`searching`/`handleSearch`/`clearSearch`) — بقي بحث **واحد** = حقل "فلترة برقم الطلب" في شريط الفلاتر (يبحث محلياً بالرقمين فوديكس+التطبيق). (2) **قائمة الفرع موحّدة:** استُبدل `BranchSelector` بمكوّن `Dropdown` نفسه (خيارات: جميع الفروع + الفروع من `branches`) ليطابق شكل قائمتي الحالة/التطبيق. (3) **تصغير الهيدر:** `.page-header` padding `2rem 0 1.5rem`→`1rem 0 0.9rem`، `.header-top` margin-bottom `2rem`→`1rem`، `.page-title` `1.75rem`→`1.4rem`، تقليل هامش الـ badge. ✅ lint + build نظيف. |
| 2026-06-30 | **📊 مزامنة تصدير Excel (`exportExcel.js`) مع الجدول الجديد.** أعمدة الملف صارت: التطبيق (اسم من `resolveDeliveryApp`) · رقم بالتطبيق (`resolveAppOrderNumber`) · رقم فوديكس (`resolveFoodicsNumber`=reference) · الفرع · الحالة (`STATUS_LABELS`) · **مصدر التحديث** (نص جاهز/تسليم: النظام/فوديكس عبر `getSourceText` بسطرين) · وقت الطلب · وقت الجاهزية · مدة التحضير (9 أعمدة، نطاق A:I). أُزيل `getChannelName` المبني على `channel_link`. التوقيع صار `exportOrdersToExcel(orders, branchName, sources)` ويُستدعى بـ `filteredOrders` + `statusSources` (الملف يطابق الجدول المرئي بعد الفلترة). `wrapText` + ارتفاع صف 40 للمكتمل. ✅ lint + build نظيف. |
| 2026-06-30 | **🔧 تحسينات جدول التحليلات: قائمة منسدلة مخصّصة + تصحيح رقم فوديكس + مصدر تغيير الحالة + ضبط الفلاتر.** (1) **رقم فوديكس صحّح:** `resolveFoodicsNumber` صار يقرأ `raw_qr_data.foodics_order.reference` (الرقم المرجعي مثل 531087) بدل العمود `foodics_order_number` (الذي يخزّن `order.number` = التسلسل اليومي القصير). (2) **مصدر تغيير الحالة (جديد):** عمود "مصدر التحديث" يبيّن لكل انتقال (قيد التحضير→جاهز، جاهز→مكتمل) هل تمّ من **النظام** أم من **فوديكس** — الاستدلال: نظامنا يكتب دائماً `scan_logs` (`ready_scan` للجاهز، `delivered` للتسليم) بينما webhook فوديكس لا يكتب شيئاً ⇒ وجود السجل=النظام، غيابه=فوديكس. تُجلب السجلات ضمن الفترة (`buildSourceMap`) + لنتائج البحث بالـ ids. شارات `SourceBadge` (النظام=بنفسجي/فوديكس=سماوي). (3) **قائمة منسدلة مخصّصة `Dropdown`** (بدل `select` الافتراضي): زر + قائمة منبثقة مع إغلاق بالنقر الخارجي/Escape، وتعرض **لوجو التطبيق** في فلتر التطبيقات. (4) **فلتر الحالة:** أُزيلت "ملغي" و"جديد" (الحالات الفعّالة فقط). (5) **فلتر الرقم:** يبحث بالرقمين معاً — رقم فوديكس (reference) + رقم التطبيق (`resolveAppOrderNumber`). CSS: `.dd*`، `.src-badge*`. ✅ lint + build نظيف. |
| 2026-06-30 | **📋 تطوير جدول "سجل الطلبات" في التحليلات (`Analytics.jsx`) — مصدر الطلب + رقمَا التطبيق وفوديكس + فلاتر شاملة.** المتطلب: معرفة مصدر كل طلب (التطبيق) مع لوجوه، ورقم الطلب داخل التطبيق ورقمه في فوديكس، وعرض **كل** الطلبات بأي حالة مع فلترة بالحالة/التاريخ/الفرع/التطبيق/الرقم. **التنفيذ:** (1) `deliveryApps.js`: دالتان جديدتان `resolveAppOrderNumber(order)` (الرقم الكامل داخل التطبيق من `meta.external_number` بلا قص) و`resolveFoodicsNumber(order)` (= `foodics_order_number`/`order_id`). (2) `Analytics.jsx`: مكوّنان داخليان `OrderRow` + `OrdersTableHead` بأعمدة جديدة (التطبيق=لوجو `DeliveryAppLogo` size sm + اسم بلون الهوية، رقم بالتطبيق، رقم فوديكس، الفرع، الحالة، وقت الطلب، وقت الجاهزية، مدة التحضير) — يُستخدمان في جدولي البحث والسجل معاً (حلّا محل العمود المضلّل "القناة" المبني على `channel_link` الفارغ لطلبات فوديكس). (3) **جلب كل الطلبات** (أُزيل فلتر `.not('prep_duration_seconds','is',null)`، `.limit(1000)`) → الجدول يعرض كل الحالات. (4) **فلاتر محلية** (state `statusFilter`/`appFilter`/`numberFilter` + `filteredOrders` memo): قائمة حالة، قائمة تطبيق (مبنية من `DELIVERY_APPS`+`DIRECT_APP`، تطابق بـ `resolveDeliveryApp().key`)، حقل رقم (يبحث في order_id/foodics_order_number/رقم التطبيق) — تطبّق على الجدول فقط؛ التاريخ+الفرع يظلّان يقودان الجلب. (5) `branchChartData` يحسب المتوسط على الطلبات ذات `prep_duration_seconds` فقط (تفادي تحيّز بعد إدخال كل الحالات). (6) CSS: `.app-cell`/`.filter-select`/`.filter-number-input` + بادجات `status-badge--new`/`--cancelled`. ✅ lint + build نظيف. |
| 2026-06-30 | **🐞 إصلاح تراكب زر القائمة مع العنوان في `AdminSidebar.jsx`.** زر الـ toggle (X) ثابت `position:fixed` أعلى يمين القائمة (`right:12`, عرض 42px) وكان هيدر القائمة بـ padding يمين `1.25rem` فقط فتطلع شارة "لوحة التحكم"/العنوان تحته. **الحل:** زيادة padding اليمين للهيدر إلى `3.75rem`. ✅ lint نظيف. |
| 2026-06-30 | **🎨 إعادة تصميم شاشة العرض (`DisplayDashboard.jsx`) بنفس روح كرت الفرع — مبسّطة.** (1) استُبدل تخطيط العمودين (`PreparingColumn` \| `ReadyColumn`) بـ **شبكة موحّدة `disp-grid`** بحالتين فقط: **جاهز أولاً ثم قيد التحضير** (الأولوية للجاهز). (2) **`DisplayCard` مكوّن داخلي مبسّط:** بادج الحالة العلوي + لوجو + رقم الطلب فقط — **بلا زر** (الكرت أقصر)، بلا نوع الطلب، بلا اسم التطبيق، بلا عدّاد وقت. (3) ألوان: قيد التحضير=لون التطبيق+بادج أصفر، جاهز=أزرق+بادج أزرق (متطابقة مع شاشة الفرع). (4) CSS جديد في `DisplayDashboard.css` (`.disp-grid`/`.disp-card*`)؛ متجاوب (**7 طلبات في الصف على الشاشات الكبيرة ≥1200px** عبر `repeat(7,1fr)`، عمودان على الجوال). (5) `PreparingColumn`/`ReadyColumn` صارت غير مستخدمة (الملفات باقية)؛ `OrderCard` باقٍ لـ `DeliveredColumn`. قسم "تم تسليمها" المطوي + منطق الصوت/الإكمال التلقائي/الفلترة كما هي. ✅ lint + build نظيف. |
| 2026-06-30 | **🐞 إصلاح اختفاء لوجوهات تطبيقات التوصيل على الجوال (تعارض أسماء classes).** كان `index.css` يحوي `@media (max-width:1024px){ .app-logo{ display:none !important } }` المقصود به **لوجو كبة زون الثابت بالزاوية** (`AppLogo.jsx`)، لكن `DeliveryAppLogo` (`DeliveryAppBadge.jsx`) يستخدم نفس class `.app-logo` → فكانت لوجوهات التطبيقات تختفي على الجوال في كل الشاشات (الفرع + العرض + العميل). **الحل:** إعادة تسمية class اللوجو الثابت إلى `.kz-fixed-logo` (في `AppLogo.jsx` + `index.css`) ليقتصر الإخفاء عليه وحده. ✅ build نظيف. |
| 2026-06-30 | **🎨 توحيد شكل كرت الطلب (`Kitchen.jsx` / `Kitchen.css`).** بعد مراجعة: الكروت كانت غير متطابقة لأن صف التاجات (نوع الطلب + اسم التطبيق) كان يلتف بشكل مختلف فيتحرّك "توصيل/استلام" لأعلى وأسفل. **التغيير:** تحويل الكرت لتخطيط **عمودي موحّد** — اللوجو في الأعلى (`kitchen-card-logo`، size `md`، يصغر على الجوال عبر `.app-logo--md` لكنه يبقى ظاهراً) ← صف نوع الطلب + اسم التطبيق بعرض الكرت الكامل مع `flex-wrap: nowrap` (لا يلتف، نفس المكان دائماً) ← كلمة "طلب" صغيرة ملاصقة **فوق** الرقم الكبير (`kitchen-card-order` عمودي) ← الوقت ← الزر. الكرت `align-items:center; text-align:center`. حُذف `.kitchen-card-top`/`.kitchen-card-info`/`.kitchen-card-icon` غير المستخدمة. ✅ lint + build نظيف. |
| 2026-06-30 | **🎨 إعادة تصميم عرض الطلبات في شاشة الفرع (`Kitchen.jsx`).** (1) **دمج القسمين** (قيد التحضير + جاهز) في قسم واحد "**الطلبات النشطة**" بأولوية ترتيب: قيد التحضير أولاً ثم الجاهز. (2) **بادج حالة ملصق أعلى كل بطاقة** (`kitchen-card-badge`): قيد التحضير=أصفر `#FFC400`، جاهز=أزرق، تم الاستلام=أخضر. (3) **ألوان البطاقة حسب الحالة:** قيد التحضير=لون تطبيق التوصيل (inline)، جاهز=أزرق، تم الاستلام=أخضر (`kitchen-card--{mode}`). (4) **الأزرار بلون الحالة التالية:** "جهز" أزرق (action ready)، "تم التسليم" أخضر (action delivered). (5) **قسم "تم الاستلام" مطوي** عبر شيك بوكس (`showDelivered` محلي) يعرض `delivered` من `useOrders`؛ أُزيلت آلية `fadingOrders` (الانتقال بين الأقسام صار تلقائياً عبر Realtime). (6) **تبسيط الهيدر:** اسم الفرع + شيك بوكس "إظهار كل الطلبات على شاشة العرض" فقط (حُذف اللوجو/الساعة/العدّادات). (7) **إصلاح التجاوب للجوال:** grid `auto-fill minmax(190px,1fr)`؛ عمودان ≤768px وعمود واحد ≤380px؛ هيدر `flex-wrap`. **السلوك الوظيفي (Edge Function `foodics-update-status`) لم يتغيّر.** ✅ lint + build نظيف. **التالي:** إعادة تصميم شاشة العرض `DisplayDashboard`. |
| 2026-03-24 | إنشاء الملف المرجعي الشامل — قراءة كاملة للمشروع |
| 2026-03-24 | إضافة نظام المصادقة: Login, AuthContext, ProtectedRoute, useIdleTimer, AddUser, LogoutButton + migrations (006-008) |
| 2026-03-27 | إضافة صفحة المطبخ Kitchen.jsx — عرض طلبات التحضير في grid مع زر جاهز ومودال تأكيد |
| 2026-03-27 | إضافة UserSidebar للمستخدم العادي (role: user) — يحتوي على ماسح الطلبات + شاشة المطبخ + تسجيل الخروج |
| 2026-03-27 | إضافة تجديد تلقائي لجلسة DB — get_session_user يمدد expires_at 12 ساعة مع كل استدعاء RPC (010_session_auto_refresh.sql) |
| 2026-03-27 | إضافة ميزة البحث برقم الطلب في صفحة التحليلات — بحث ilike في كل الطلبات مع عرض الحالة |
| 2026-03-27 | إصلاح مشكلة عدم تحديث الشاشات تلقائياً (تعديل useOrders hook لدمج الـ payload) وإصلاح خطأ صامت في رسائل Kitchen.jsx عند الفشل |
| 2026-03-28 | إضافة صفحة سجل النظام (Logs) — تتبع المتصلون الآن مع نظام heartbeat للحضور |
| 2026-04-05 | تغيير هوية الألوان بالكامل من KebbaZone (برتقالي #FF5100) إلى هوية Foodics (بنفسجي #440099) — شمل index.css + كل ملفات CSS و JSX |
| 2026-04-05 | نقل AdminSidebar و UserSidebar من اليسار إلى اليمين (right: 0، translateX(100%) للإخفاء، borderLeft). نقل AppLogo من اليمين إلى اليسار لتفادي التعارض. تغيير formatClock() إلى نظام 12 ساعة مع صباحاً/مساءً. إضافة formatDate() وعرض التاريخ تحت الساعة في DisplayDashboard |
| 2026-04-05 | إضافة خاصية تعديل المستخدمين في AddUser.jsx — زرار تعديل + فورم يتحول لوضع التعديل + RPC جديدة rpc_update_user_secure (013_rpc_update_user.sql) + تحديث rpc_list_users_secure لإرجاع branch_id |
| 2026-06-11 | مزامنة المرجع مع الكود الفعلي: توثيق AppLogo / AdminSidebar / LoadingScreen، تغيير تصدير التحليلات من CSV إلى Excel (exportExcel.js + ExcelJS)، تصحيح صلاحية `/analytics` إلى user+admin |
| 2026-06-11 | تنظيف شامل — lint نظيف 100% + build ناجح: (1) حذف test-realtime.js؛ (2) إصلاح useIdleTimer (`useRef(0)` بدل `Date.now()`)؛ (3) تعطيل قاعدتي React Compiler التجريبيتين set-state-in-effect + preserve-manual-memoization في eslint.config.js؛ (4) eslint-disable موضعي في AuthContext (useAuth) و AddUser (effect لمرة واحدة)؛ (5) تحويل ألوان تصدير Excel من البرتقالي القديم إلى البنفسجي #440099 (هوية Foodics) |
| 2026-06-21 | تجهيز تكامل Foodics (غير مفعّل بعد — ينتظر بيانات Foodics): migrations 014-018 (حالة طلب جديدة `new` + أعمدة source/foodics_order_id/order_type/accepted_at + جداول foodics_config و foodics_branch_mapping + توسيع scan_logs + RPC جديد rpc_kitchen_accept_order) + هيكل Edge Function `supabase/functions/test-foodics-webhook`. الخطة الكاملة: docs/plans/2026-06-21-foodics-realtime-flow-plan.md. **متوقف على:** access_token + webhook secret/توقيع + عيّنة payload + Foodics branch IDs. التغييرات الأمامية (useOrders/Kitchen/Display) لم تُنفّذ بعد. |
| 2026-06-22 | **مراجعة بعد دليل Foodics الرسمي:** اكتُشف أن webhook فوديكس يرسل `entity.id` فقط (لا تفاصيل) ولا يرسل توقيعاً. أُعيدت كتابة Edge Function `test-foodics-webhook` لتجلب الطلب عبر `GET /orders/{id}` بالـ access_token ثم تنشئه بحالة `new`. أُضيف عمود `api_base_url` لـ foodics_config (Sandbox افتراضياً). أُضيف سكربت `scripts/foodics-list-branches.mjs` لجلب الفروع. حُذفت فكرة HMAC. الناقص: التوكن (إيميل المالك) + تسجيل الـ webhook + تأكيد order.created للكاشير. التفاصيل: docs/FOODICS_HANDOFF.md. |
| 2026-06-22 | **إلغاء QR نهائياً + تحويل الواجهة لتدفق Foodics.** حُذف: Scanner.jsx/.css, ScannerView.jsx/.css, useScanner.js, parseQR.js, generate-qrcodes.html, مكتبة html5-qrcode, مسار /scan وكل مراجعه. **التدفق الجديد:** Foodics webhook → `new` → (زر استلام) → `preparing` → (زر جاهز) → `ready` → مكتمل. **الواجهة:** useOrders يدعم `new` ويُصدّر `incoming`؛ Kitchen.jsx قسمان (طلبات جديدة بزر استلام + قيد التحضير بزر جاهز) عبر rpc_kitchen_accept_order و rpc_scanner_mark_ready؛ OrderCard يعرض شارة نوع الطلب؛ DisplayDashboard يصدر الصوت عند الاستلام لا الإنشاء. المسار الافتراضي للموظف صار /kitchen. ✅ build ناجح. وثيقة التسليم: docs/FOODICS_HANDOFF.md. **لا تظهر طلبات حتى يُفعّل webhook فوديكس (مقصود).** |
| 2026-06-23 | **تفعيل تكامل Foodics على Sandbox (الباك إند جاهز).** اكتُشف من JWT أن صلاحيات التوكن قراءة فقط (`orders.list`, `general.read`, `orders.limited.decline/deliver`) — تكفي لـ `GET /orders/{id}` (أُكّد بـ 404 لا 403) لكن **لا تسمح بإنشاء طلب** (`POST /orders` = 403)، فإنشاء طلب الاختبار ينتظر iPad Cashier App. **ما تم فعلياً على Supabase (مشروع ucpudjjahbctzluseipo):** تشغيل migrations 014→018، تخزين التوكن في foodics_config (business 922240, Sandbox URL), ملء ربط الفرع 018 (Foodics `a217671a...` → فرعنا B01). **نُشرت** Edge Function عبر `supabase functions deploy test-foodics-webhook --no-verify-jwt`. اختبار دخان بـ id وهمي رجّع `fetch_failed/404` = نجاح (function+توكن+وصول لـ Foodics مؤكد). **المتبقي:** (1) طلب حقيقي من iPad Cashier؛ (2) تسجيل الـ webhook عبر support@foodics.com على `…/functions/v1/test-foodics-webhook` بحدث order.created. |
| 2026-06-25 | **🔄 تطبيق الورك فلو الجديد (delivery-driven) + مزامنة عكسية لفوديكس.** حسب `KebbaZone_Foodics_Integration_Flow`: (1) **إلغاء خطوة "الاستلام"** — الطلب يدخل `preparing` مباشرة عند `delivery_status=1` (الكود باقٍ موقوفاً للإرجاع). (2) **مزامنة عكسية لفوديكس:** زر "جاهز" → `PUT /orders/{id} {delivery_status:2}`؛ زر **"تم التسليم" جديد** → `PUT {delivery_status:5, driver_collected_at:UTC}` — عبر Edge Function جديدة `foodics-update-status` (scope مؤكّد: `orders.limited.deliver` من توكن production). (3) **inbound** أُعيدت كتابته (`foodics-webhook`) ليعالج `order.delivery.created/updated` + منطق `status`/`delivery_status` (preparing/ready/completed/cancelled) مع forward-only و idempotency؛ `test-foodics-webhook` صار alias له. (4) **migration 019:** حالة `cancelled` + أعمدة `order_source`/`foodics_delivery_status`/`delivered_at`/`synced_to_foodics` + `scan_type='delivered'` + RPCs `rpc_kitchen_mark_ready_synced`/`rpc_kitchen_mark_delivered` + base URL إنتاجي. (5) **المطبخ:** قسمان "قيد التحضير" (زر جاهز) + "جاهز" (زر تم التسليم أزرق). (6) auto-complete موقوف لطلبات foodics. ✅ lint نظيف + build ناجح. **⚠️ نشر/إعداد متبقٍ:** المشروع انتقل لـ Supabase جديد (`mbmrcvazjdzkarysqwgb`) — تشغيل migrations 014→019، تخزين توكن production، ملء branch mapping، نشر الـ Functions، تسجيل أحداث `order.delivery.created/updated` على رابط `foodics-webhook`. التفاصيل: `docs/FOODICS_HANDOFF.md`. |
| 2026-06-26 | **فحص مصدر الطلبات للكشف عن تطبيق التوصيل.** فُحصت الطلبات الفعلية في DB عبر anon key. النتيجة: **كل الطلبات (شاملة طلب التوصيل #9) من تطبيق الكاشير اليدوي** (`app_id=8f9eb3f6-7987-4f66-aa8c-478c34d0c568`, `source=1`, `device=Cashier 1`) — لا يوجد طلب تطبيق توصيل حقيقي عبر Deliverect بعد (طلب #9 محاكاة: اسم العميل كُتب "Hunger station" يدوياً، driver/delivery_status=null). **الاستنتاج:** أدق إشارة للكشف = `app_id` (لكل تطبيق app_id فريد). حُدّث `resolveDeliveryApp` ليفحص `APP_ID_MAP` (تُملأ بعد أول طلب حقيقي) + يتجاهل اسم عميل الكاشير + يفحص customer.name/reference/reference_x كحقول مرشّحة. أُضيف `scripts/foodics-inspect-orders.mjs` (يطبع مصدر كل طلب ويبرز أي طلب app_id≠الكاشير + raw_qr_data كامل). **المتبقي: طلب توصيل حقيقي واحد من تطبيق فعلي → نشغّل السكربت → نملأ APP_ID_MAP.** |
| 2026-06-26 | **هوية كروت تطبيقات التوصيل (لون + لوجو لكل تطبيق) — الكارت كله يأخذ هوية التطبيق.** أُضيف `src/config/deliveryApps.js` (خريطة 7 تطبيقات: كيتا/هنقرستيشن/جاهز/ذا شيفز/نينجا/مرسول/تويو — لكل منها name/logo/color/ink/onColor + `DIRECT_APP` للمباشر + `hexToRgba()`) ودالة `resolveDeliveryApp(order)` التي تكشف التطبيق من بيانات الطلب الخام (`raw_qr_data.foodics_order.aggregator/source/...` + channel_link) — **جاهزة للربط بعد تأكيد الحقل من اختبار طلب توصيل حقيقي (الطلبات تأتي عبر وسيط Deliverect).** أُضيف مكوّن `DeliveryAppBadge.jsx/.css` يصدّر `DeliveryAppLogo` (صندوق لوجو بإطار ملوّن، أحجام sm/md/lg/xl) و`DeliveryAppPill` (بادج اسم التطبيق بخلفية لون الهوية). **التصميم النهائي للكارت (المطبخ KitchenCard + شاشة العميل OrderCard):** خلفية متدرّجة بلون التطبيق + إطار بلون التطبيق (الكارت كله مهوّى لا مجرد خط جانبي) + لوجو كبير (xl=104px) أعلى اليسار + بادج اسم التطبيق + رقم طلب كبير جداً (2.6rem مطبخ / حتى 6xl عميل). كارت العميل بلا أزرار. نُسخت اللوجوهات إلى `src/assets/img/apps/`. **ملاحظة:** كيتا تستخدم الأخضر (#1AA67D من لوجوها) لا الأصفر، للتفريق عن هنقرستيشن. معاينة بتبويبين (مطبخ/عميل): `delivery-cards-preview.html`. ✅ build + lint نظيف. |
| 2026-06-27 | **إصلاح فشل INSERT لطلبات Foodics المتكررة الأرقام (خطأ 23505).** عند الاختبار، فشل تسجيل طلبات جديدة بخطأ `duplicate key ... orders_order_id_branch_id_key (order_id, branch_id)=(1, …)`. **السبب:** القيد `UNIQUE(order_id, branch_id)` من نظام QR المُلغى، بينما Foodics يعيد ترقيم الطلبات (`order.number`) كل يوم/فرع فيتكرر 1،2،3… ويصطدم بطلبات سابقة؛ فحص التكرار في الـ function يتم بـ `foodics_order_id` (UUID جديد فيمرّ) لكن الـ INSERT يقع على القيد القديم. **الحل:** migration `019_drop_orders_order_id_branch_unique.sql` يحذف القيد (`DROP CONSTRAINT IF EXISTS orders_order_id_branch_id_key`). التفرّد الحقيقي مضمون أصلاً عبر `idx_orders_foodics_order_id` (UNIQUE من 014). **يجب تطبيقه على المشروعين (تيست + برود).** |
| 2026-06-27 | **فصل بيئتي التيست والبرودكشن (مشروعا Supabase).** تأكّد وجود مشروعين: `ucpudjjahbctzluseipo`=برودكشن (function `foodics-webhook`) و`mbmrcvazjdzkarysqwgb`=تيست (function `test-foodics-webhook`). **تشخيص:** أوردر اختبار اتسجّل في التيست لكن مظهرش في شاشة المطبخ لأن الواجهة كانت موجّهة للبرودكشن (`.env`). الكود/الـ webhook/الـ branch mapping كلها سليمة — المشكلة توجيه فقط. **الحل:** أُضيف `.env.development.local` بقيم مشروع التيست → `npm run dev` يفتح على التيست تلقائياً (يتجاوز `.env`)، و`npm run build` يبقى على البرودكشن. توثيق القسم 7.1. توجيه الـ webhooks تلقائي (كل function تكتب في داتابيز مشروعها). |
| 2026-06-24 | **✅ تكامل Foodics يعمل end-to-end على Sandbox.** اكتُشف من الـ payload الخام أن webhook `order.created` يحمل **الطلب كاملاً داخل `payload.order`** (الفرع/الرقم/النوع/المنتجات)، وليس `entity.id` فقط كما كان مفترضاً. لذلك أُعيدت كتابة Edge Function `test-foodics-webhook` لتقرأ الطلب **مباشرة من جسم الـ webhook** بدون أي نداء API — ما ألغى نهائياً مشكلة الصلاحيات (403 على `GET /orders/{id}` لغياب `orders.limited.read`)، وحدّ المعدّل (90/دقيقة)، وزمن النداء الإضافي. **مسار احتياطي (fallback):** إن لم يحمل الـ webhook الطلب، يُجلب عبر `GET /orders?filter[id]={id}` (scope: orders.list). أُضيف logging للـ payload الخام و`Order source`. أُضيف `scripts/foodics-check-webhook.mjs` و`scripts/foodics-postman-collection.json`. **اختبار حقيقي ناجح:** طلبات من iPad Cashier ظهرت في المطبخ (فرع B01، نوع محلي). **التأخير المرصود ~1 دقيقة وكله من جهة فوديكس:** الفجوة بين `closed_at` و `created_at` ≈ 49–60 ثانية (مزامنة الجهاز بالسحابة)، والـ webhook يصلنا خلال ~2 ثانية من `created_at`. **المتبقي للإنتاج:** تأكيد فوديكس لزمن تسليم أقل (مستهدف ≤5 ثوانٍ) + ضمان بقاء الـ webhook مفعّلاً. التفاصيل: docs/FOODICS_HANDOFF.md. |
| 2026-06-29 | **✅ تفعيل التكامل على الإنتاج end-to-end + ربط فروع الإنتاج الـ10 — الطلبات تدخل المطبخ بنجاح.** اكتُشف أن التوكن القديم (`922240`) هو **Sandbox** (يرجّع `404 Business not found` على `api.foodics.com/v5`). بتوكن الإنتاج الحقيقي جُلبت الفروع عبر `GET /branches` فرجعت **10 فروع**، الـ `reference` بتاع كلٍّ منها يطابق `branches.code` عندنا (B01..B10) والأسماء مطابقة (تأكيد 100% — قُورنت بيانات Foodics بصفوف جدول `branches` الإنتاجي صفاً بصف). أُضيف migration **`022_seed_foodics_branch_mapping_prod.sql`** يربط الـ10 فروع بمعرّفات Foodics الإنتاجية (ربط بالـ `reference`/`code`، `ON CONFLICT DO NOTHING`). أُضيف Postman collection مركّز **`scripts/foodics-postman-branch-mapping.json`** (base_url إنتاج + Whoami + GET branches يولّد SQL الربط تلقائياً). **تم فعلياً:** طُبِّق 022 على مشروع الإنتاج + خُزِّن توكن الإنتاج في `foodics_config`. **✅ مؤكّد عملياً:** الطلبات تدخل من فوديكس إلى شاشة المطبخ على الإنتاج بنجاح والورك فلو شغّال. |
| 2026-06-30 | **✅ تأكيد الـ outbound من توثيق فوديكس الرسمي + تشخيص خطأ 404.** عند اختبار زر التحديث ظهر `Foodics PUT failed 404 "entity not found"`. مراجعة **Delivery Management Integration** بموقع مطوري فوديكس أكّدت أن الـ endpoint الصحيح فعلاً **`PUT {base_url}/orders/{order_id}`** بحقول `delivery_status (1..6)` + توقيتات UTC (`driver_assigned_at`/`dispatched_at`/`driver_collected_at`/`delivered_at`) + `driver_id`، scope `orders.limited.deliver`. **⇒ الكود سليم؛ الـ 404 = الأوردر غير موجود بالتوكن/البيئة المستخدمة (الأرجح `foodics_config.api_base_url` لسه Sandbox أو توكن business مختلف — لأن inbound لا يستخدم الـ API فلم تُختبر هذه القيم من قبل).** **التغييرات:** (1) `foodics-status.ts`: إزالة كل `❓ CONFIRM` من قسم الـ outbound (مؤكّد)، وتصحيح توقيت "تم التسليم" من `driver_collected_at` → **`delivered_at`** (الحقل الصحيح للحالة 5). (2) `foodics-update-status`: logging يطبع الرابط الكامل + الـ body لكشف بيئة الساندبوكس. **خطوة التحقق:** Postman (توكن إنتاج + base إنتاج) `GET /orders?filter[id]=<id>` — لو رجع الأوردر فالمشكلة في `foodics_config`؛ إن لم يرجع فالأوردر ليس ضمن business التوكن. **⚠️ يلزم إعادة نشر `foodics-update-status`.** |
| 2026-06-30 | **🔀 إعادة تسمية "شاشة المطبخ" → "شاشة الفرع" + مفتاح إظهار/إخفاء غير-التوصيل على شاشة العرض (متزامن realtime لكل فرع).** المتطلب: شاشة العرض تُظهر طلبات تطبيقات التوصيل فقط افتراضياً؛ موظف الفرع يتحكم في إظهار الباقي عبر شيك بوكس على **شاشة الفرع** (route `/kitchen` كما هو) يتزامن لحظياً مع شاشة العرض على أي جهاز. **شاشة الفرع/المطبخ نفسها تعرض كل الطلبات دائماً** (الإخفاء يخص شاشة العرض فقط). **التنفيذ:** (1) migration **`023_branch_display_settings.sql`** — جدول `branch_settings(branch_id PK, show_all_on_display bool default false, updated_at)` + RLS مفتوح + صف افتراضي لكل فرع + `ALTER PUBLICATION supabase_realtime ADD TABLE branch_settings`. (2) hook جديد **`useBranchDisplaySetting`** (يقرأ + يشترك realtime + `setShowAll` upsert). (3) **`deliveryApps.js`**: دالة `isDeliveryAppOrder(order)` (= `resolveDeliveryApp != direct`). (4) **`DisplayDashboard`**: يفلتر preparing/ready/delivered (+الصوت+العدّاد) بـ `isDeliveryAppOrder` ما لم يكن `showAll`. (5) **`Kitchen.jsx`**: شيك بوكس في الهيدر + عنوان "الفرع —" + CSS `.kitchen-display-toggle`. (6) تحديث التسميات: AdminSidebar/UserSidebar/AddUser/BranchSelect/Logs → "شاشة الفرع". ✅ lint + build نظيف. **⚠️ نشر:** تطبيق `023` على مشروعي التيست + البرود (وتفعيل realtime على `branch_settings`). |
| 2026-06-30 | **✅ عرض رقم تطبيق التوصيل بدل رقم فوديكس + ربط هوية التطبيق بـ `meta.channelLink`.** من دراسة طلبات الإنتاج الحقيقية (`GET /orders` type=2) اكتُشف أن: **اسم التطبيق** = `order.meta.channelLink` ("Jahez"/"Keeta"...)، و**رقم الطلب الظاهر في التطبيق** = `order.meta.external_number` ("Jahez: 547077316" / "Keeta: 5094\n4466…"). **⚠️ `type=2` ليس كله توصيل** — يشمل سفري يدوي من الكاشير (`source=1`، بلا channelLink)؛ الإشارة الصحيحة لكشف طلب تطبيق = **وجود `meta.channelLink`**. **التنفيذ في `src/config/deliveryApps.js`:** (1) أُضيف `meta.channelLink` + `meta.external_number` لمرشّحات `resolveDeliveryApp` (الأدق)؛ (2) دالة جديدة `resolveDisplayNumber(order)` تستخرج الرقم القصير الظاهر في التطبيق (ما بعد ":" + أول سطر) وترجع `order_id` كـ fallback. ربطها في `OrderCard.jsx` (شاشة العميل) و`Kitchen.jsx` (كرت المطبخ + مودال التأكيد). **القرار:** عرض الرقم القصير (5094) لا الطويل، ثم لاحقاً **اختصاره لآخر 4 أرقام من اليمين** فقط لطلبات التوصيل (547077316 → 7316) عبر `firstLine.slice(-4)` في `resolveDisplayNumber`؛ غير-التوصيل تبقى بكامل order_id. ✅ lint + build نظيف. **يعتمد على:** احتواء `raw_qr_data.foodics_order.meta` على هذه الحقول (مؤكّد من قائمة الطلبات؛ يُتحقّق أن webhook order.created يحملها أيضاً). |
| 2026-06-30 | **Postman collection لدراسة طلبات التوصيل (type=2) + تأكيد الـ outbound.** أُضيف `scripts/foodics-postman-delivery-orders.json` (إنتاج) بثلاثة طلبات: (1) Whoami؛ (2) **Get Delivery Orders** — يجلب آخر ~20 طلب `type=2`، ويطبع في الـ Console: جدول الحقول المرشّحة لرقم تطبيق التوصيل (`number`/`reference`/`delivery.reference`/`meta.*`) + توزيع `delivery_status` + JSON كامل لأول 3 طلبات — **الهدف: تحديد الحقل الذي يحمل رقم الطلب الظاهر في تطبيق التوصيل لعرضه بدل رقم فوديكس عند `order_type=2`**؛ (3) **Verify Outbound (PUT)** — يحدّث `delivery_status` لطلب واحد (محمي: لا يعمل إلا بملء `test_order_id`) لتأكيد أن التوكن (`orders.limited.deliver`) يسمح بـ 1→3→5 ويُنعكس في فوديكس (403 على 3 = يسمح بـ 5 فقط). **معلّق على:** جلب الطلبات الحقيقية ودراستها. |
| 2026-06-30 | **✅ تأكيد قيم فوديكس رسمياً (اجتماع + إيميل) — تنظيف توثيقي لـ `foodics-status.ts`.** فوديكس أكّدت جدول `delivery_status` بالكامل: `1`=Sent to kitchen، `2`=Ready، `3`=Assigned (DMS)، `4`=Enroute (DMS)، `5`=Delivered، `6`=Cancelled (DMS) — **مطابق 100% لافتراضاتنا، لا تعديل منطق إطلاقاً**. أُكّد أيضاً: base URL `api.foodics.com/v5`، الأحداث المشتركة على الإنتاج `orders.created`/`orders.updated`، scopes توكن الإنتاج (`general.read` + `orders.list` + `orders.limited.deliver`)، ورابط الـ webhook الإنتاجي `…/functions/v1/foodics-webhook`. **التغيير (تعليقات فقط):** تحويل علامات `❓ CONFIRM` المؤكَّدة إلى `✅` في `_shared/foodics-status.ts` (أرقام delivery_status + الأحداث + scope) + تحديث رأس `foodics-webhook`. **باقٍ `❓` (لم يحدّده الإيميل):** أرقام `order.type`، أرقام `order.status` للإلغاء، وصيغة جسم الـ PUT الصادر (الـ endpoint + حقل التوقيت + هل `orders.limited.deliver` يسمح بـ ready=2 أم delivered=5 فقط) — تُحسم عند أول كتابة فعلية. |
| 2026-06-29 | **تصغير كرت شاشة العميل (`OrderCard`) — تقليل المساحات الفاضية.** أُعيد ترتيب الكرت لتخطيط أفقي مدمج: عمود معلومات (يمين) + لوجو (يسار) في صف واحد بدل تكدّس رأسي. تقليلات: `padding` من `1.25rem 1.5rem` → `0.75rem 0.85rem`؛ اللوجو من `xl`(104px) → `lg`(84px)؛ رقم الطلب من `6xl` → `5xl`؛ كل المسافات الرأسية `mt-3/mt-2` → `mt-1`؛ شارات نوع الطلب/جاهز إلى `text-[10px]`. **اسم التطبيق (`DeliveryAppPill`) صُغِّر خالص** عبر `size="sm"` + تصغير `.app-pill--sm` في `DeliveryAppBadge.css` (`0.65rem`، padding `0.2rem 0.55rem`). الحدود `rounded-2xl/border-[2.5px]` → `rounded-xl/border-2`. |
| 2026-06-29 | **إلغاء الفراغ الأبيض نهائياً (لوجو+رقم كمجموعة ملاصقة) + تقسيم شاشة العرض نصفين بالعرض.** (1) **الكروت (`OrderCard` + `KitchenCard`):** الصف صار `justify-center` وعمود المعلومات **بلا `flex-1`** (عرض = المحتوى) فاللوجو والرقم يلتصقان كمجموعة واحدة متمركزة بلا تمدّد يخلق فراغاً. رقم العميل صُغِّر إلى `text-3xl lg:text-4xl` ليلائم الكروت الضيّقة. (2) **شاشة العرض (`DisplayDashboard`):** `.dash-columns` رجعت `flex-direction: row` (`align-items: flex-start`) — **قيد التحضير يمين / جاهز شمال جنب بعض** (كل قسم نصف العرض)؛ وشبكتا `PreparingColumn`/`ReadyColumn` صارتا `repeat(auto-fill, minmax(210px,1fr))` (كروت ضيّقة تملأ النصف بلا فراغ) وعمود واحد على الموبايل (≤768px حيث `.dash-columns` تعود عمودية). اللوجو والرقم يبقيان ظاهرين على الموبايل (مجموعة متمركزة). ✅ build ناجح. |
| 2026-06-29 | **توسيط محتوى الكرت لإزالة الفراغ الجانبي + شاشة الفرع 6 كروت/صف بأزرار أصغر.** (1) **`OrderCard` (شاشة العميل):** عمود المعلومات صار `items-center` وكل صفوفه `justify-center` — الرقم والوقت والشارات تتمركز في المساحة المتبقية بدل التصاقها بجانب اللوجو وترك فراغ كبير على اليسار. (2) **`Kitchen` (شاشة الفرع):** `kitchen-card-info` توسيط (`align-items:center`)؛ `kitchen-grid` من 4 → **6 أعمدة** (fallback 4 عند ≤1280px ثم 3 عند ≤900px)؛ تصغير كل الأزرار (`kitchen-ready/delivered/accept-btn`) padding `0.75rem`→`0.45rem` وخط `1rem`→`0.85rem` (تبقى بعرض الكرت = عرض اللوجو+الرقم). ✅ build ناجح. |
| 2026-06-29 | **إلصاق اللوجو بالرقم + 4 كروت في الصف + تطبيق نفس التصميم على شاشة الفرع.** (1) **`OrderCard`:** أُلغي `justify-between` (كان يخلق فجوة أفقية كبيرة بين اللوجو والرقم) — اللوجو الآن أول عنصر ملاصق لعمود المعلومات (`flex items-center gap-2.5`، المعلومات `flex-1`). (2) **شاشة العرض (`DisplayDashboard`):** `.dash-columns` صار `flex-direction: column` (قسما قيد التحضير/جاهز فوق بعض)، وشبكتا `PreparingColumn`/`ReadyColumn` من عمودين → **4 أعمدة** (`repeat(4,1fr)`، مع fallback 3 ثم 2 للشاشات الأصغر). (3) **شاشة الفرع (`Kitchen` + `KitchenCard`):** نفس إعادة التصميم — كرت مدمج بصف علوي `kitchen-card-top` (لوجو `lg` ملاصق لـ `kitchen-card-info`)، اسم التطبيق `size="sm"`، `kitchen-grid` → **4 أعمدة** (fallback 3)، تقليل padding/border/خط الرقم (`2.6rem`→`2.1rem`) والشارات. ✅ build ناجح. |
| 2026-06-28 | **دمج جهازين + اعتماد ورك فلو delivery-driven مع هوية الكروت.** بعد merge فرعين متباعدين: (1) **اعتُمد فلو المطبخ delivery-driven** (قيد التحضير → جاهز → تم التسليم، بلا خطوة استلام) **مع** هوية تطبيقات التوصيل (لوجو/لون) في `Kitchen.jsx` و`OrderCard`. (2) **شاشة العميل** صار بها 3 أقسام: قيد التحضير + جاهزة + **"تم تسليمها" (قسم مطوي `DeliveredColumn`)**؛ `useOrders` يجلب الآن آخر 50 طلباً مكتملاً ويُصدّر `delivered`. (3) **🔑 تجميع كل افتراضات حالات فوديكس في ملف واحد** `supabase/functions/_shared/foodics-status.ts` (أنواع الطلب، أحداث webhook، أرقام `delivery_status`/`status`، جسم الـ PUT الصادر) — كل بند مجهول معلَّم بـ `// ❓ CONFIRM`؛ الدالتان inbound/outbound تستوردان منه. **عند وصول قيم فوديكس الحقيقية: عدّل هذا الملف وحده ثم أعد نشر الـ Functions.** (4) إعادة ترقيم migration المكرر: `020_drop_orders_order_id_branch_unique` + `021_foodics_delivery_flow` (كان كلاهما 019). **النواقص من فوديكس موثّقة في `docs/FOODICS_MEETING_CHECKLIST.md`.** ✅ lint + build نظيف. |

| 2026-07-08 | **إلغاء انتهاء الجلسة (idle timeout) نهائياً — المستخدم يبقى مسجلاً حتى يعمل logout بنفسه.** حذف `useIdleTimer.js` وإزالة استدعائه من `ProtectedRoute.jsx`. في `AuthContext.jsx`: `isSessionValid` تعيد true طالما الجلسة موجودة، وحذف `updateActivity` و`lastActivity` و`IDLE_TIMEOUT_MS`. migration جديدة `026_sessions_never_expire.sql`: default لـ `expires_at` أصبح 10 سنوات + تمديد الجلسات الحالية + إعادة تعريف `get_session_user` بدون sliding-window refresh. ✅ build + lint نظيف. ⚠️ يجب تشغيل الـ migration في Supabase SQL Editor. |
| 2026-07-11 | **🐞 إصلاح "تعلّق" الفرع للأدمن على شاشة الفرع/شاشة العرض + قائمة تبديل فرع في القائمة الجانبية.** **السبب:** `AdminSidebar.jsx` كان يشتق `branchCode` روابط `needsBranch` من `searchParams.get('branch')` **الحالي فقط** — فبمجرد فتح `/kitchen?branch=A` أو `/display?branch=A`، أي رابط تاني في القائمة يعيد نفس الفرع A دائماً، ولا سبيل لتغييره إلا بزيارة صفحة بلا `?branch=` (مثل التحليلات) ثم الرجوع (عندها `branchCode` يفرغ فتظهر `BranchSelect` من جديد). **الحل:** (1) hook جديد `useAdminBranch.js` يحفظ الفرع المختار في `localStorage` (`kz_admin_branch`) بحيث يبقى ثابتاً بين كل الصفحات لا مرتبطاً بالـ URL الحالي فقط. (2) `AdminSidebar.jsx`: أُضيفت قائمة `<select>` "الفرع الحالي" أسفل اسم المستخدم في الهيدر (تجلب الفروع النشطة) — تغييرها يحفظ الاختيار عبر `useAdminBranch` فوراً، وإن كان الأدمن واقفاً على `/kitchen` أو `/display` يحدّث `?branch=` في نفس الصفحة عبر `setSearchParams` (بلا تنقّل، شاشة الفرع/العرض تتحدّث لحظياً). `branchCode` المستخدم لبناء الروابط صار `urlBranchCode || savedBranchCode || session.branchCode` بدل الاعتماد على الرابط الحالي وحده. (3) `isActive`/التنقّل صارا عبر `useLocation()` الرسمي بدل الاعتماد الضمني على `window.location` العام. ✅ lint + build نظيف. |
| 2026-07-12 | **⚡ إلغاء waterfall التحميل عند فتح شاشة الفرع/شاشة العرض (نفس روح إصلاح التحليلات — migration 027 — لكن السبب هنا عدد الرحلات لا ضخامة الـ payload).** **السبب:** فتح `/kitchen` أو `/display` كان يشغّل 3 نداءات Supabase **متتالية**: `useBranch` يجلب صف الفرع بالـ code أولاً، وبعدها فقط (لأنهما يحتاجان `branch.id`) ينطلق `useOrders` ثم `useBranchDisplaySetting`. كل رحلة على شبكة الإنتاج قِيست فعلياً **~700ms-1s ثابتة بغض النظر عن حجم البيانات** (حتى استعلام تافه على جدول فروع بـ10 صفوف)، فمجموع الانتظار قبل ظهور أول طلب كان يتجاوز ثانية-ثانتين، وأي إجراء لاحق (زر جاهز/تسليم) يضيف نفس التأخير الثابت لأنه نداء شبكة مستقل — هذا الجزء (زمن الرحلة الواحدة) عائد لموقع/بنية مشروع Supabase وليس شيئاً يُصلَح بالكود. **الحل (الجزء القابل للإصلاح بالكود = عدد الرحلات):** (1) migration جديدة **`028_branch_bootstrap.sql`** — RPC `rpc_branch_bootstrap(p_branch_code)` ترجع **الفرع + الطلبات (بنفس تقليم `v_orders_display`) + إعداد شاشة العرض معاً في رحلة واحدة**. (2) `useBranch.js` صار يستدعي هذه الـ RPC بدل `.from('branches').select()` المباشر، ويُرجع أيضاً `initialOrders`/`initialDisplaySetting`. (3) `useOrders(branchId, initialOrders)` و`useBranchDisplaySetting(branchId, initialSetting)`: صارا يقبلان بذرة أولية اختيارية — لو وصلت يُبذر بها الـ state مباشرة **بدل رحلة جلب إضافية مكرّرة**؛ الـ Realtime subscriptions تبقى تعمل كالمعتاد فور معرفة `branch.id`. (4) `Kitchen.jsx`/`DisplayDashboard.jsx`: تمرير `initialOrders`/`initialDisplaySetting` من `useBranch()` للـ hooks التانية. **النتيجة:** رحلة شبكة واحدة بدل ثلاث متتالية لأول ظهور للطلبات. ✅ lint + build نظيف. **⚠️ يلزم تشغيل `028_branch_bootstrap.sql` في Supabase SQL Editor قبل النشر — بدونها الشاشتان ستعرضان "الفرع غير موجود" فوراً (تأكّدت الـ RPC غير موجودة بعد بفحص مباشر على مشروع الإنتاج).** |

---

> ⚠️ **تعليمات:** يجب تحديث هذا الملف عند كل تعديل في المشروع. أي تاسك جديد يقرأ هذا الملف فقط بدلاً من قراءة المشروع كاملاً.
