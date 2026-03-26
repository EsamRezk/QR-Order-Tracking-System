# Foodics Integration Design — QR Order Tracking System

> **Date:** 2026-03-24
> **Status:** Approved
> **Scope:** ربط نظام تتبع الطلبات مع Foodics POS لاستقبال الطلبات تلقائياً

---

## 1. Overview

### المشكلة
حالياً الطلبات تُنشأ يدوياً عبر مسح QR (المسح الأول ينشئ الطلب). نريد أن تظهر الطلبات تلقائياً من Foodics بحالة "قيد التجهيز"، والمسح يكون فقط لتحويل الطلب لـ "جاهز".

### الحل
ربط Foodics عبر Webhook (`order.created`) → Supabase Edge Function تستقبل الطلب وتنشئه تلقائياً → الشاشة تعرضه فوراً عبر Realtime.

### التدفق الجديد
```
قبل:  [QR Scan #1] → إنشاء طلب (preparing) → [QR Scan #2] → جاهز
بعد:  [Foodics Webhook] → إنشاء طلب (preparing) → [QR Scan] → جاهز
```

### المتطلبات
- كل الطلبات (أونلاين + كاشير) تظهر تلقائياً
- الطلب يظهر خلال 5-10 ثواني بحد أقصى من إنشائه في Foodics
- كل الفروع على نفس حساب Foodics

---

## 2. Architecture

```
Foodics POS (طلب جديد)
    ↓ webhook: order.created (خلال ثواني)
Supabase Edge Function (/foodics-webhook)
    ↓ التحقق من التوقيع + استخراج البيانات
    ↓ ربط Foodics branch_id → branch_id المحلي
    ↓ INSERT into orders (status: preparing, source: foodics)
    ↓ رد 200 OK فوراً
Supabase Realtime (postgres_changes)
    ↓ يبث التغيير للعملاء المشتركين
شاشة العرض (DisplayDashboard) → الطلب يظهر فوراً
    ↓
موظف يمسح QR → يبحث عن الطلب → يحوله لـ "جاهز"
```

---

## 3. Database Changes

### 3.1 جدول جديد: `foodics_branch_mapping`
```sql
CREATE TABLE foodics_branch_mapping (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    foodics_branch_id   TEXT UNIQUE NOT NULL,
    branch_id           UUID NOT NULL REFERENCES branches(id),
    created_at          TIMESTAMPTZ DEFAULT now()
);
```
يربط كل فرع في Foodics بالفرع المقابل في نظامنا.

### 3.2 جدول جديد: `foodics_config`
```sql
CREATE TABLE foodics_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     TEXT NOT NULL,
    access_token    TEXT NOT NULL,
    webhook_secret  TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```
يخزّن بيانات الاتصال بـ Foodics (OAuth token + webhook secret).

### 3.3 تعديل جدول `orders`
```sql
ALTER TABLE orders ADD COLUMN foodics_order_id TEXT;
ALTER TABLE orders ADD COLUMN foodics_order_number TEXT;
ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'qr';
ALTER TABLE orders ADD COLUMN order_type TEXT;
```

| العمود | الوصف |
|--------|-------|
| `foodics_order_id` | UUID الطلب من Foodics |
| `foodics_order_number` | رقم الطلب المعروض (للعميل/الموظف) |
| `source` | مصدر الطلب: `'foodics'` أو `'qr'` |
| `order_type` | نوع الطلب: `'dine_in'`, `'pickup'`, `'delivery'` |

### 3.4 تعديل `scan_logs`
- نوع المسح يتغير من `first_scan`/`second_scan` إلى `ready_scan` للطلبات القادمة من Foodics

---

## 4. Supabase Edge Function: `foodics-webhook`

### المسؤوليات
1. استقبال `POST` من Foodics عند `order.created`
2. التحقق من صحة الطلب (webhook secret / headers)
3. استخراج البيانات من payload (branch_id, order number, type)
4. البحث في `foodics_branch_mapping` عن الفرع المحلي
5. إدخال الطلب في `orders` بحالة `preparing`
6. الرد بـ `200 OK` فوراً

### المنطق
```
POST /foodics-webhook
  → التحقق من headers/secret
  → (فشل؟ → 401)
  → استخراج event type
  → (مش order.created؟ → 200 OK + تجاهل)
  → قراءة branch_id من payload
  → البحث في foodics_branch_mapping
  → (مش موجود؟ → log error + 200 OK)
  → التحقق من عدم تكرار الطلب (foodics_order_id unique)
  → (مكرر؟ → 200 OK + تجاهل)
  → INSERT order (status: preparing, source: foodics)
  → 200 OK
```

### ملاحظات
- دائماً نرد `200 OK` حتى لو فيه خطأ داخلي — لأن Foodics يبلوك الـ endpoint بعد 100+ فشل في دقيقة
- Foodics يتطلب رد خلال 5 ثواني
- 3 محاولات إعادة فقط عند الفشل

---

## 5. Frontend Changes

### 5.1 `useScanner.js` — التغيير الأكبر

**السلوك الجديد:**
- المسح → يبحث عن الطلب بـ `order_id` + `branch_id`
  - **موجود وحالته `preparing`** → يحوله لـ `ready` + يسجل `ready_scan`
  - **موجود وحالته `ready`** → رسالة "الطلب جاهز بالفعل"
  - **مش موجود** → رسالة "الطلب غير موجود في النظام"

**يُزال:** منطق إنشاء الطلب عند المسح الأول (INSERT) — لم يعد مطلوباً.

### 5.2 `OrderCard.jsx` — إضافات عرض
- عرض `source` (أيقونة Foodics أو QR)
- عرض `order_type` (توصيل / استلام / محلي)
- عرض `foodics_order_number` بجانب `order_id`

### 5.3 `parseQR.js` — تعديل بسيط
- مطابقة الـ `order_id` المستخرج من QR مع `foodics_order_number` أو `order_id` في قاعدة البيانات

### 5.4 `DisplayDashboard.jsx` — بدون تغيير جوهري
- الطلبات تظهر تلقائياً عبر Realtime (نفس الآلية الحالية)

---

## 6. Foodics Setup (مرة واحدة)

### 6.1 تسجيل التطبيق
- إنشاء تطبيق في Foodics Developer Portal
- الحصول على `client_id` + `client_secret`
- Scopes المطلوبة:
  - `general.read` — قراءة الفروع والمنتجات
  - `orders.limited.read` — قراءة الطلبات

### 6.2 OAuth Flow
- صاحب الحساب يربط التطبيق من Foodics App Store
- نحصل على `access_token` ونخزنه في `foodics_config`

### 6.3 تسجيل الـ Webhook
- URL: `https://<project>.supabase.co/functions/v1/foodics-webhook`
- الأحداث: `order.created`
- ممكن نضيف `order.updated` مستقبلاً لتتبع الإلغاءات

### 6.4 ربط الفروع
- جلب قائمة فروع Foodics عبر `GET /branches`
- ربط كل `foodics_branch_id` بالفرع المقابل في `foodics_branch_mapping`

---

## 7. Foodics API Reference

| البند | التفاصيل |
|-------|---------|
| **Base URL (Production)** | `api.foodics.com/v5` |
| **Base URL (Sandbox)** | `api-sandbox.foodics.com/v5` |
| **Auth** | OAuth 2.0 — `Authorization: Bearer ACCESS_TOKEN` |
| **Rate Limit** | 90 requests/min per token per IP |
| **Webhook Timeout** | 5 ثواني — يجب الرد فوراً |
| **Webhook Retries** | 3 محاولات — بعد 100+ فشل/دقيقة يتم البلوك لساعة |
| **Order Statuses** | 1=Pending, 2=Active, 3=Declined, 4=Closed, 5=Returned, 6=Joined, 7=Void, 8=Draft |
| **Order Types** | 1=Dine In, 2=Pickup, 3=Delivery |
| **Webhook Events** | `order.created`, `order.updated`, `order.delivery.created`, `order.delivery.updated` |

---

## 8. Summary of All Changes

| المكون | التغيير |
|--------|---------|
| DB: `orders` | إضافة `foodics_order_id`, `foodics_order_number`, `source`, `order_type` |
| DB: `foodics_branch_mapping` (جديد) | ربط فروع Foodics بفروعنا |
| DB: `foodics_config` (جديد) | تخزين OAuth token + webhook secret |
| Supabase Edge Function (جديد) | `foodics-webhook` — استقبال وإنشاء الطلبات |
| `useScanner.js` | المسح يبحث عن الطلب ويحوله لجاهز فقط |
| `scan_logs` | نوع المسح يصير `ready_scan` |
| `OrderCard.jsx` | عرض مصدر الطلب + نوعه + رقم Foodics |
| `parseQR.js` | مطابقة الطلب من QR مع الطلبات الموجودة |
| Migration files (جديد) | `009_foodics_tables.sql`, `010_alter_orders.sql` |
