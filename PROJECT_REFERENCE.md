# 📋 مرجع المشروع الشامل — QR Order Tracking System (كبة زون)

> **آخر تحديث:** 2026-03-24
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
│   │   ├── useOrders.js        # جلب الطلبات + Realtime subscription
│   │   ├── useScanner.js       # منطق مسح QR + إنشاء/تحديث الطلبات
│   │   └── useSound.js         # تشغيل صوت الإشعار (Web Audio API)
│   │
│   ├── utils/
│   │   ├── formatTime.js       # دوال تنسيق الوقت بالعربية
│   │   └── parseQR.js          # تفسير بيانات QR → {order_id, channel_link, location}
│   │
│   ├── components/
│   │   ├── BranchSelector.jsx  # قائمة منسدلة لاختيار الفرع
│   │   ├── LogoutButton.jsx    # زر تسجيل الخروج (يظهر في كل الصفحات)
│   │   ├── OrderCard.jsx       # بطاقة الطلب (preparing / ready)
│   │   ├── PreparingColumn.jsx # عمود "قيد التحضير"
│   │   ├── UserSidebar.jsx     # شريط جانبي للمستخدم العادي (scan + kitchen + logout)
│   │   ├── ProtectedRoute.jsx  # حماية المسارات حسب الصلاحية
│   │   ├── ReadyColumn.jsx     # عمود "جاهز"
│   │   ├── ReadyColumn.css     # ستايل عمود جاهز
│   │   ├── ScannerView.jsx     # كاميرا QR (html5-qrcode)
│   │   └── StatsCard.jsx       # بطاقة إحصائية بسيطة
│   │
│   ├── pages/
│   │   ├── AddUser.jsx           # صفحة إضافة المستخدمين (admin فقط) + CSS
│   │   ├── AddUser.css
│   │   ├── DisplayDashboard.jsx  # شاشة العرض الرئيسية + CSS
│   │   ├── DisplayDashboard.css
│   │   ├── Login.jsx             # صفحة تسجيل الدخول + CSS
│   │   ├── Login.css
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
        └── 008_seed_admin_user.sql
```

---

## 4. Routes (المسارات)

| المسار | الصفحة | الأدوار المسموحة | الوصف |
|--------|--------|-----------------|-------|
| `/login` | `Login` | عام | تسجيل الدخول |
| `/display?branch=CODE` | `DisplayDashboard` | screen, admin | شاشة عرض الطلبات (للتلفاز/الشاشة) |
| `/scan?branch=CODE` | `Scanner` | user, admin | ماسح QR للموظفين |
| `/analytics` | `Analytics` | admin | تقارير وإحصائيات |
| `/admin` | `Admin` | admin | إدارة الفروع (CRUD) |
| `/kitchen?branch=CODE` | `Kitchen` | user, admin | شاشة المطبخ — عرض الطلبات قيد التحضير + زر جاهز |
| `/add-user` | `AddUser` | admin | إضافة وإدارة المستخدمين |
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
status                 TEXT CHECK ('preparing','ready','completed')
scanned_at             TIMESTAMPTZ DEFAULT now()  -- وقت أول مسح
ready_at               TIMESTAMPTZ                -- وقت الجاهزية
completed_at           TIMESTAMPTZ                -- وقت الاكتمال
prep_duration_seconds  INTEGER (GENERATED)        -- مدة التحضير (تلقائي)
raw_qr_data            JSONB                      -- بيانات QR الخام
created_at             TIMESTAMPTZ DEFAULT now()
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

### RPC Functions (دوال قاعدة البيانات)
| الدالة | الوصف | الحماية |
|--------|-------|---------|
| `authenticate_user(p_username, p_password)` | تسجيل الدخول + التحقق من الباسورد | SECURITY DEFINER |
| `create_user(p_admin_id, ...)` | إنشاء مستخدم جديد | admin فقط |
| `delete_user(p_admin_id, p_user_id)` | حذف مستخدم | admin فقط (لا يحذف نفسه) |
| `list_users(p_admin_id)` | جلب قائمة المستخدمين (بدون باسورد) | admin فقط |

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

### دورة حياة الطلب
```
[QR Scan #1] → INSERT order (status: preparing) + INSERT scan_log (first_scan)
       ↓
[QR Scan #2] → UPDATE order (status: ready, ready_at) + INSERT scan_log (second_scan)
       ↓  (أو)
[زر جاهز في المطبخ] → UPDATE order (status: ready, ready_at) + INSERT scan_log (second_scan)
       ↓
[Auto Timeout] → UPDATE order (status: completed, completed_at)
   (بعد 5 دقائق من ready_at، قابل للتغيير عبر VITE_READY_TIMEOUT_MINUTES)
```

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
- `logout()` → يمسح الجلسة → يوجه لـ `/login`
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

#### `LogoutButton.jsx`
- زر تسجيل خروج بتصميم متوافق مع الثيم
- يستخدم `useAuth().logout()`
- يظهر في headers الصفحات (Scanner, Analytics, Admin, AddUser)

#### `StatsCard.jsx`
- بطاقة إحصائية بسيطة
- Props: `label`, `value`, `unit`, `color`

---

### 8.7 Pages

#### `DisplayDashboard.jsx` (شاشة العرض)
- **URL:** `/display?branch=CODE`
- إذا لم يحدد فرع → يعرض `BranchSelect`
- حالة **Activate Sound:** يطلب تفعيل الصوت (ضغطة المستخدم)
- يعرض:
  - Header: اسم الفرع + ساعة حية + عدد الطلبات النشطة
  - عمودين: `PreparingColumn` + `ReadyColumn`
  - حالة فارغة عند عدم وجود طلبات
- **Auto-complete:** الطلبات الجاهزة تكتمل تلقائياً بعد `VITE_READY_TIMEOUT_MINUTES`
- **صوت الإشعار:** عند وصول طلب جديد
- **Fading animation:** عند إكمال طلب

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
- زر تصدير CSV

#### `Admin.jsx` (إدارة الفروع)
- **URL:** `/admin`
- CRUD للفروع:
  - إضافة/تعديل فرع (name_ar, name_en, code, location_label)
  - تفعيل/تعطيل فرع
- يعرض جدول الفروع + حالتها
- يعرض روابط الفروع النشطة (`/display?branch=` و `/scan?branch=`)

#### `Kitchen.jsx` (شاشة المطبخ)
- **URL:** `/kitchen?branch=CODE`
- إذا لم يحدد فرع → يعرض `BranchSelect target="kitchen"`
- يعرض جميع الطلبات `preparing` في شبكة بطاقات (grid layout)
- **Header:** اسم الفرع + ساعة حية + عدد الطلبات قيد التحضير
- **KitchenCard:** يعرض رقم الطلب، القناة (جاهز/هنقرستيشن/مباشر)، الوقت المنقضي، زر "جاهز"
- **Confirmation Modal:** عند الضغط على "جاهز" يظهر مودال تأكيد → يستدعي `rpc_scanner_mark_ready`
- **Fading animation:** عند تحويل طلب لجاهز
- **حالة فارغة:** رسالة "لا توجد طلبات قيد التحضير"
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
- فورم إضافة: username, password, branch (dropdown), role, route
- جدول المستخدمين الحاليين مع إمكانية الحذف
- يستخدم RPC functions: `create_user`, `list_users`, `delete_user`
- الأدمن لا يمكنه حذف حسابه

#### `Kitchen.jsx` (شاشة المطبخ)
- **URL:** `/kitchen?branch=CODE`
- إذا لم يحدد فرع → يعرض `BranchSelect`
- يعرض الطلبات "قيد التحضير" في تصميم Grid متجاوب (`auto-fill, minmax(280px, 1fr)`)
- كل بطاقة تعرض: رقم الطلب، قناة التوصيل، وقت الانتظار، زر "جاهز" أخضر
- زر "جاهز" → Modal تأكيد → يستدعي `rpc_scanner_mark_ready` → الطلب يختفي بـ fade animation
- Header: اسم الفرع + ساعة حية + عدد الطلبات قيد التحضير
- Realtime عبر `useOrders` hook

#### `BranchSelect.jsx` (اختيار الفرع)
- يظهر عند الدخول على `/display` أو `/scan` أو `/kitchen` بدون `?branch=`
- يعرض قائمة بطاقات الفروع النشطة
- عند الضغط يوجه للصفحة المناسبة مع `?branch=CODE`

---

## 9. الألوان الرئيسية (Design Tokens)

```css
--kz-primary:      #FF5100    /* البرتقالي الأساسي */
--kz-primary-light: #FF7A3D   /* برتقالي فاتح */
--kz-dark:         #1E1810    /* الخلفية الرئيسية */
--kz-dark-lighter: #2a2018    /* خلفية أفتح */
--kz-dark-card:    #2f2520    /* خلفية البطاقات */
--kz-cream:        #F8F5F4    /* كريمي */
--kz-red:          #ce0b0b    /* أحمر (أخطاء) */
--kz-gold:         #f7941d    /* ذهبي */
--kz-text:         #575250    /* نص رئيسي */
--kz-text-light:   #8a8280    /* نص ثانوي */
--kz-green:        #22c55e    /* أخضر (جاهز) */
--kz-green-dark:   #16a34a    /* أخضر غامق */
border-color:      #3d3028    /* حدود البطاقات */
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
| 2026-03-24 | إنشاء الملف المرجعي الشامل — قراءة كاملة للمشروع |
| 2026-03-24 | إضافة نظام المصادقة: Login, AuthContext, ProtectedRoute, useIdleTimer, AddUser, LogoutButton + migrations (006-008) |
| 2026-03-27 | إضافة صفحة المطبخ Kitchen.jsx — عرض طلبات التحضير في grid مع زر جاهز ومودال تأكيد |
| 2026-03-27 | إضافة UserSidebar للمستخدم العادي (role: user) — يحتوي على ماسح الطلبات + شاشة المطبخ + تسجيل الخروج |
| 2026-03-27 | إضافة تجديد تلقائي لجلسة DB — get_session_user يمدد expires_at 12 ساعة مع كل استدعاء RPC (010_session_auto_refresh.sql) |
| 2026-03-27 | إضافة ميزة البحث برقم الطلب في صفحة التحليلات — بحث ilike في كل الطلبات مع عرض الحالة |
| 2026-03-27 | إصلاح مشكلة عدم تحديث الشاشات تلقائياً (تعديل useOrders hook لدمج الـ payload) وإصلاح خطأ صامت في رسائل Kitchen.jsx عند الفشل |

---

> ⚠️ **تعليمات:** يجب تحديث هذا الملف عند كل تعديل في المشروع. أي تاسك جديد يقرأ هذا الملف فقط بدلاً من قراءة المشروع كاملاً.
