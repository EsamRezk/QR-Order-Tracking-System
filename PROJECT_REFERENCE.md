# 📋 مرجع المشروع الشامل — QR Order Tracking System (كبة زون)

> **آخر تحديث:** 2026-04-05
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
│   │   └── AuthContext.jsx     # سياق المصادقة (login, logout, session, idle)
│   │
│   ├── hooks/
│   │   ├── useBranch.js        # جلب بيانات الفرع من URL param
│   │   ├── useIdleTimer.js     # مراقبة نشاط المستخدم (12 ساعة timeout)
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
│   │   ├── BranchSelector.jsx  # قائمة منسدلة لاختيار الفرع
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
        └── 022_seed_foodics_branch_mapping_prod.sql  # ربط فروع الإنتاج الـ10 (B01..B10) بمعرّفات Foodics الحقيقية
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
UNIQUE(order_id, branch_id)
```
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
- يجلب بيانات الفرع من Supabase (`branches` table)
- يرجع: `{ branch, loading, error, branchCode }`
- يصدّر أيضاً: `resolveBranchByLocation(location)` — يبحث بالـ `location_label`

#### `useOrders.js`
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

#### `useIdleTimer.js`
- يراقب نشاط المستخدم (mouse, keyboard, click, touch, scroll)
- Throttling: يحدّث `lastActivity` كل 30 ثانية فقط
- فحص دوري كل 60 ثانية لانتهاء الجلسة
- **12 ساعة** timeout للـ user/admin
- يتجاهل role = screen (الجلسة لا تنتهي)

#### `useHeartbeat.js`
- يرسل heartbeat كل 30 ثانية لتتبع الحضور
- يحدّث الصفحة الحالية في active_sessions table
- يعمل تلقائياً في ProtectedRoute لجميع المستخدمين
- يستخدم `rpc_upsert_heartbeat` RPC function

#### `useSound.js`
- يستخدم Web Audio API
- يحمّل `/notification.mp3` lazily
- يرجع: `{ play, loadSound }`

---

### 8.5 Context

#### `AuthContext.jsx`
- يدير الجلسة في `localStorage` بمفتاح `kz_session`
- بنية الجلسة: `{ userId, username, branch, branchCode, branchId, route, role, lastActivity }`
- `login(username, password)` → يستدعي `authenticate_user` RPC → يحفظ الجلسة → يعيد التوجيه حسب `route`
- `logout()` → يحذف الحضور من active_sessions → يمسح الجلسة → يوجه لـ `/login`
- `updateActivity()` → يحدّث `lastActivity` (للـ user/admin فقط)
- `getDefaultRoute()` → يحسب المسار الافتراضي حسب `route` + `branchCode`
- مزامنة بين التابات عبر `storage` event
- session validity: screen لا تنتهي، user/admin تنتهي بعد 12 ساعة

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
- يفعّل `useIdleTimer` لتتبع النشاط
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
- **DisplayCard (مكوّن داخلي مبسّط):** بادج الحالة العلوي + لوجو التطبيق + رقم الطلب **فقط** — بلا زر، بلا نوع الطلب، بلا اسم التطبيق، بلا عدّاد وقت. قيد التحضير = لون التطبيق + بادج أصفر؛ جاهز = أزرق + بادج أزرق.
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
- **بحث بالطلب:** حقل بحث برقم الطلب (ilike) — يبحث في كل الداتا بيز بغض النظر عن الفلاتر، يعرض النتائج في جدول منفصل مع عمود الحالة
- فلترة حسب: فرع + فترة زمنية (اليوم / 7 أيام / 30 يوم)
- KPI Cards: إجمالي الطلبات، متوسط وقت التحضير، أسرع/أبطأ طلب
- **Charts (Recharts):**
  - BarChart: متوسط وقت التحضير لكل فرع
  - AreaChart: الطلبات حسب الساعة
- جدول بيانات لآخر 50 طلب
- زر تصدير **Excel (.xlsx)** عبر `exportOrdersToExcel()` — ملف منسّق بلوجو وألوان واتجاه RTL

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
- **KitchenCard:** يعرض لوجو/هوية التطبيق، نوع الطلب، رقم العرض (`resolveDisplayNumber`)، الوقت المنقضي.
- **Confirmation Modal:** يستدعي Edge Function `foodics-update-status` (action `ready`/`delivered`)؛ الانتقال بين الأقسام تلقائي عبر Realtime.
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
12. **Session:** يحفظ في localStorage — ينتهي بعد 12 ساعة للـ user/admin، لا ينتهي للـ screen

---

## 13. سجل التغييرات

| التاريخ | الوصف |
|---------|-------|
| 2026-06-30 | **🎨 إعادة تصميم شاشة العرض (`DisplayDashboard.jsx`) بنفس روح كرت الفرع — مبسّطة.** (1) استُبدل تخطيط العمودين (`PreparingColumn` \| `ReadyColumn`) بـ **شبكة موحّدة `disp-grid`** بحالتين فقط: **جاهز أولاً ثم قيد التحضير** (الأولوية للجاهز). (2) **`DisplayCard` مكوّن داخلي مبسّط:** بادج الحالة العلوي + لوجو + رقم الطلب فقط — **بلا زر** (الكرت أقصر)، بلا نوع الطلب، بلا اسم التطبيق، بلا عدّاد وقت. (3) ألوان: قيد التحضير=لون التطبيق+بادج أصفر، جاهز=أزرق+بادج أزرق (متطابقة مع شاشة الفرع). (4) CSS جديد في `DisplayDashboard.css` (`.disp-grid`/`.disp-card*`)؛ متجاوب (270px تلفاز، عمودان جوال). (5) `PreparingColumn`/`ReadyColumn` صارت غير مستخدمة (الملفات باقية)؛ `OrderCard` باقٍ لـ `DeliveredColumn`. قسم "تم تسليمها" المطوي + منطق الصوت/الإكمال التلقائي/الفلترة كما هي. ✅ lint + build نظيف. |
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

---

> ⚠️ **تعليمات:** يجب تحديث هذا الملف عند كل تعديل في المشروع. أي تاسك جديد يقرأ هذا الملف فقط بدلاً من قراءة المشروع كاملاً.
