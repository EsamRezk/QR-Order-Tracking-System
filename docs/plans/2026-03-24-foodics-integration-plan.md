# Foodics Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ربط نظام تتبع الطلبات مع Foodics POS بحيث تظهر الطلبات تلقائياً كـ "قيد التجهيز"، والمسح يحولها لـ "جاهز" فقط.

**Architecture:** Foodics يرسل webhook عند إنشاء طلب → Supabase Edge Function تستقبله وتنشئ الطلب في قاعدة البيانات → Realtime يوصله للشاشة فوراً → الموظف يمسح QR لتحويل الطلب لجاهز.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), Supabase PostgreSQL, Foodics REST API v5, React 19

**Design Doc:** `docs/plans/2026-03-24-foodics-integration-design.md`

---

## Task 1: Database Migration — Foodics Tables

**Files:**
- Create: `supabase/migrations/009_foodics_config.sql`
- Create: `supabase/migrations/010_foodics_branch_mapping.sql`

**Step 1: Create `foodics_config` table migration**

```sql
-- supabase/migrations/009_foodics_config.sql
CREATE TABLE foodics_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     TEXT NOT NULL,
    access_token    TEXT NOT NULL,
    webhook_secret  TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS: مفعّل بدون policies — الوصول عبر Edge Function فقط (service_role key)
ALTER TABLE foodics_config ENABLE ROW LEVEL SECURITY;
```

**Step 2: Create `foodics_branch_mapping` table migration**

```sql
-- supabase/migrations/010_foodics_branch_mapping.sql
CREATE TABLE foodics_branch_mapping (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    foodics_branch_id   TEXT UNIQUE NOT NULL,
    branch_id           UUID NOT NULL REFERENCES branches(id),
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- RLS: مفعّل بدون policies — الوصول عبر Edge Function فقط
ALTER TABLE foodics_branch_mapping ENABLE ROW LEVEL SECURITY;
```

**Step 3: Run migrations on Supabase**

Run each SQL file in Supabase SQL Editor in order: `009` then `010`.

**Step 4: Commit**

```bash
git add supabase/migrations/009_foodics_config.sql supabase/migrations/010_foodics_branch_mapping.sql
git commit -m "feat: add foodics_config and foodics_branch_mapping tables"
```

---

## Task 2: Database Migration — Alter Orders Table

**Files:**
- Create: `supabase/migrations/011_alter_orders_foodics.sql`

**Step 1: Create migration to add Foodics columns to orders**

```sql
-- supabase/migrations/011_alter_orders_foodics.sql

-- مصدر الطلب: foodics أو qr
ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'qr';

-- معرّف الطلب من Foodics (UUID)
ALTER TABLE orders ADD COLUMN foodics_order_id TEXT;

-- رقم الطلب المعروض من Foodics
ALTER TABLE orders ADD COLUMN foodics_order_number TEXT;

-- نوع الطلب: dine_in, pickup, delivery
ALTER TABLE orders ADD COLUMN order_type TEXT;

-- فهرس للبحث السريع عن طلبات Foodics
CREATE INDEX idx_orders_foodics_order_id ON orders(foodics_order_id) WHERE foodics_order_id IS NOT NULL;
```

**Step 2: Run migration on Supabase**

Run `011_alter_orders_foodics.sql` in Supabase SQL Editor.

**Step 3: Commit**

```bash
git add supabase/migrations/011_alter_orders_foodics.sql
git commit -m "feat: add foodics columns to orders table (source, foodics_order_id, order_type)"
```

---

## Task 3: Database Migration — Update scan_logs CHECK constraint

**Files:**
- Create: `supabase/migrations/012_alter_scan_logs.sql`

**Step 1: Create migration to allow `ready_scan` type**

The current `scan_logs.scan_type` CHECK only allows `'first_scan'` and `'second_scan'`. We need to add `'ready_scan'` for the new flow.

```sql
-- supabase/migrations/012_alter_scan_logs.sql

-- إزالة القيد القديم وإضافة الجديد مع ready_scan
ALTER TABLE scan_logs DROP CONSTRAINT scan_logs_scan_type_check;
ALTER TABLE scan_logs ADD CONSTRAINT scan_logs_scan_type_check
    CHECK (scan_type IN ('first_scan', 'second_scan', 'ready_scan'));
```

**Step 2: Run migration on Supabase**

Run `012_alter_scan_logs.sql` in Supabase SQL Editor.

**Step 3: Commit**

```bash
git add supabase/migrations/012_alter_scan_logs.sql
git commit -m "feat: add ready_scan type to scan_logs constraint"
```

---

## Task 4: Supabase Edge Function — `foodics-webhook`

**Files:**
- Create: `supabase/functions/foodics-webhook/index.ts`

**Step 1: Initialize Supabase Edge Functions (if not already done)**

```bash
# إذا لم يكن Supabase CLI مثبت:
npm install -g supabase
# تأكد من وجود المجلد:
mkdir -p supabase/functions/foodics-webhook
```

**Step 2: Write the Edge Function**

```typescript
// supabase/functions/foodics-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Foodics order type mapping
const ORDER_TYPES: Record<number, string> = {
  1: 'dine_in',
  2: 'pickup',
  3: 'delivery',
}

Deno.serve(async (req) => {
  // السماح فقط بـ POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const payload = await req.json()

    // التحقق من نوع الحدث — نهتم فقط بـ order.created
    const event = payload?.event
    if (event !== 'order.created') {
      return new Response(JSON.stringify({ status: 'ignored', event }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const order = payload?.data
    if (!order) {
      return new Response(JSON.stringify({ status: 'no_data' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // استخراج بيانات الطلب
    const foodicsOrderId = order.id
    const foodicsOrderNumber = order.number?.toString() || order.reference || foodicsOrderId
    const foodicsBranchId = order.branch?.id || order.branch_id
    const orderType = ORDER_TYPES[order.type] || 'dine_in'

    // التحقق من عدم تكرار الطلب
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('foodics_order_id', foodicsOrderId)
      .maybeSingle()

    if (existingOrder) {
      return new Response(JSON.stringify({ status: 'duplicate', foodics_order_id: foodicsOrderId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // البحث عن الفرع المحلي
    const { data: branchMapping, error: branchError } = await supabase
      .from('foodics_branch_mapping')
      .select('branch_id')
      .eq('foodics_branch_id', foodicsBranchId)
      .maybeSingle()

    if (branchError || !branchMapping) {
      console.error('Branch mapping not found:', foodicsBranchId, branchError)
      return new Response(JSON.stringify({ status: 'branch_not_found', foodics_branch_id: foodicsBranchId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // إنشاء الطلب
    const { data: newOrder, error: insertError } = await supabase
      .from('orders')
      .insert({
        order_id: foodicsOrderNumber,
        branch_id: branchMapping.branch_id,
        status: 'preparing',
        source: 'foodics',
        foodics_order_id: foodicsOrderId,
        foodics_order_number: foodicsOrderNumber,
        order_type: orderType,
        raw_qr_data: { foodics_payload: order },
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(JSON.stringify({ status: 'insert_error', message: insertError.message }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('Order created:', newOrder.id, 'from Foodics:', foodicsOrderId)

    return new Response(JSON.stringify({ status: 'created', order_id: newOrder.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    // دائماً نرد 200 عشان Foodics ما يبلوك الـ endpoint
    return new Response(JSON.stringify({ status: 'error', message: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
```

**Step 3: Deploy the Edge Function**

```bash
supabase functions deploy foodics-webhook --no-verify-jwt
```

`--no-verify-jwt` مطلوب لأن Foodics يرسل requests بدون JWT token — الـ webhook public endpoint.

**Step 4: Test manually with curl**

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/foodics-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order.created",
    "data": {
      "id": "test-foodics-uuid-001",
      "number": 1001,
      "type": 2,
      "branch_id": "<FOODICS_BRANCH_ID>",
      "branch": { "id": "<FOODICS_BRANCH_ID>" }
    }
  }'
```

Expected: `{"status":"created","order_id":"<uuid>"}` (بعد إعداد branch mapping).

**Step 5: Commit**

```bash
git add supabase/functions/foodics-webhook/index.ts
git commit -m "feat: add foodics-webhook Edge Function to receive orders from Foodics"
```

---

## Task 5: Seed Foodics Branch Mapping

**Files:**
- Create: `supabase/migrations/013_seed_foodics_branch_mapping.sql`

**Step 1: Get Foodics branch IDs**

After connecting to Foodics, call `GET /branches` to get the Foodics branch IDs. Then create the mapping.

```sql
-- supabase/migrations/013_seed_foodics_branch_mapping.sql
-- ⚠️ استبدل الـ foodics_branch_id بالقيم الحقيقية من Foodics API

INSERT INTO foodics_branch_mapping (foodics_branch_id, branch_id)
SELECT '<FOODICS_ERQAA_BRANCH_ID>', id FROM branches WHERE code = 'Erqaa-01'
UNION ALL
SELECT '<FOODICS_LABAN_BRANCH_ID>', id FROM branches WHERE code = 'Laban-02'
UNION ALL
SELECT '<FOODICS_MALQA_BRANCH_ID>', id FROM branches WHERE code = 'AlMalqa-03';
```

**Step 2: Run migration after getting real Foodics branch IDs**

**Step 3: Commit**

```bash
git add supabase/migrations/013_seed_foodics_branch_mapping.sql
git commit -m "feat: seed foodics branch mapping for all branches"
```

---

## Task 6: Modify `useScanner.js` — Scan = Ready Only

**Files:**
- Modify: `src/hooks/useScanner.js`

**Step 1: Rewrite the scan logic**

The current `handleScan` does:
1. No existing order → INSERT (preparing) + log `first_scan`
2. Existing + preparing → UPDATE (ready) + log `second_scan`
3. Otherwise → `already_done`

New logic:
1. Existing + preparing → UPDATE (ready) + log `ready_scan`
2. Existing + ready/completed → `already_done`
3. No existing order → `not_found` (الطلب غير موجود)

Replace the `handleScan` function body. Key changes:

```javascript
// src/hooks/useScanner.js — updated handleScan logic

const handleScan = useCallback(async (rawText) => {
  // ... cooldown check stays the same ...

  const parsed = parseQR(rawText);
  if (!parsed?.order_id) {
    setLastResult({ action: 'error', message: 'QR غير صالح' });
    return;
  }

  setScanning(true);
  try {
    // البحث عن الطلب الموجود
    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_id', parsed.order_id)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!existingOrder) {
      // الطلب غير موجود — لم يصل من Foodics بعد
      const result = {
        action: 'not_found',
        orderId: parsed.order_id,
        message: 'الطلب غير موجود في النظام'
      };
      setLastResult(result);
      setHistory(prev => [result, ...prev].slice(0, 10));
      return;
    }

    if (existingOrder.status === 'preparing') {
      // تحويل الطلب لجاهز
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'ready', ready_at: new Date().toISOString() })
        .eq('id', existingOrder.id);

      if (updateError) throw updateError;

      // تسجيل المسح
      await supabase.from('scan_logs').insert({
        order_id: existingOrder.id,
        scan_type: 'ready_scan',
        scanned_by: null,
        device_info: navigator.userAgent,
      });

      const result = {
        action: 'ready',
        orderId: parsed.order_id,
        message: 'تم تجهيز الطلب ✓'
      };
      setLastResult(result);
      setHistory(prev => [result, ...prev].slice(0, 10));
      return;
    }

    // الطلب جاهز أو مكتمل بالفعل
    const result = {
      action: 'already_done',
      orderId: parsed.order_id,
      message: 'الطلب جاهز بالفعل'
    };
    setLastResult(result);
    setHistory(prev => [result, ...prev].slice(0, 10));

  } catch (err) {
    setLastResult({ action: 'error', message: err.message });
  } finally {
    setScanning(false);
  }
}, [branchId]);
```

**Step 2: Verify Scanner page still works**

Run: `npm run dev` and test the scan flow manually — scan a QR for an existing order and verify it transitions to ready.

**Step 3: Commit**

```bash
git add src/hooks/useScanner.js
git commit -m "feat: change scan logic to ready-only (orders come from Foodics)"
```

---

## Task 7: Update `Scanner.jsx` — Handle `not_found` Action

**Files:**
- Modify: `src/pages/Scanner.jsx`

**Step 1: Add handling for the new `not_found` action**

Find the section that renders the scan result overlay. Currently it handles `created`, `ready`, `already_done`, `error`. Add `not_found`:

- `not_found` → yellow/warning overlay with message "الطلب غير موجود في النظام"
- Remove `created` action handling (no longer used)
- Keep `ready`, `already_done`, `error`

The overlay color logic should be:
```javascript
// ألوان حسب نوع الإجراء
const overlayColors = {
  ready: '#22c55e',        // أخضر — تم التجهيز
  already_done: '#f7941d', // ذهبي — مكرر
  not_found: '#eab308',    // أصفر — غير موجود
  error: '#ce0b0b',        // أحمر — خطأ
};
```

**Step 2: Test manually**

Scan a QR that doesn't match any order → should see yellow "الطلب غير موجود" overlay.

**Step 3: Commit**

```bash
git add src/pages/Scanner.jsx
git commit -m "feat: add not_found scan result and remove created action"
```

---

## Task 8: Update `OrderCard.jsx` — Show Source & Order Type

**Files:**
- Modify: `src/components/OrderCard.jsx`

**Step 1: Add source and order type display**

Add to the card:
- If `order.source === 'foodics'`: show small Foodics badge/label
- Show `order.foodics_order_number` if available (بجانب `order_id`)
- Show `order.order_type` as text:
  - `dine_in` → "محلي"
  - `pickup` → "استلام"
  - `delivery` → "توصيل"

```javascript
// Order type labels
const ORDER_TYPE_LABELS = {
  dine_in: 'محلي',
  pickup: 'استلام',
  delivery: 'توصيل',
};

// داخل الـ JSX، بجانب رقم الطلب:
{order.order_type && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">
    {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
  </span>
)}

// عرض رقم Foodics إذا موجود
{order.foodics_order_number && order.foodics_order_number !== order.order_id && (
  <span className="text-xs opacity-70">#{order.foodics_order_number}</span>
)}
```

**Step 2: Verify on DisplayDashboard**

Run `npm run dev`, check that existing orders still display correctly. New Foodics orders should show the type badge.

**Step 3: Commit**

```bash
git add src/components/OrderCard.jsx
git commit -m "feat: show order type and Foodics source on OrderCard"
```

---

## Task 9: Environment Variables & Configuration

**Files:**
- Modify: `.env` (local reference only — actual secrets in Supabase dashboard)

**Step 1: Add Foodics config to Supabase Edge Function secrets**

These are set via Supabase dashboard (Settings → Edge Functions → Secrets), NOT in `.env`:

```
SUPABASE_URL=<already set>
SUPABASE_SERVICE_ROLE_KEY=<already set>
```

The Edge Function uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` which are auto-available in Supabase Edge Functions.

**Step 2: Insert Foodics config into database**

After completing OAuth with Foodics:

```sql
INSERT INTO foodics_config (business_id, access_token, webhook_secret)
VALUES ('<FOODICS_BUSINESS_ID>', '<ACCESS_TOKEN>', '<WEBHOOK_SECRET>');
```

**Step 3: Register webhook in Foodics**

Contact Foodics support or configure in app settings:
- URL: `https://<PROJECT_REF>.supabase.co/functions/v1/foodics-webhook`
- Events: `order.created`

---

## Task 10: Update `PROJECT_REFERENCE.md`

**Files:**
- Modify: `PROJECT_REFERENCE.md`

**Step 1: Add Foodics integration section**

Add a new section `## 14. Foodics Integration` with:
- Overview of the integration
- New tables: `foodics_config`, `foodics_branch_mapping`
- New columns on `orders`: `source`, `foodics_order_id`, `foodics_order_number`, `order_type`
- Edge Function: `foodics-webhook`
- New order lifecycle flow
- New scan logic (ready only)

**Step 2: Update section 6 (Business Logic)**

Update the order lifecycle:
```
قبل:  [QR Scan #1] → preparing → [QR Scan #2] → ready → [Auto] → completed
بعد:  [Foodics Webhook] → preparing → [QR Scan] → ready → [Auto] → completed
```

**Step 3: Update changelog table**

Add entry: `| 2026-03-24 | Foodics integration: webhook, new tables, scan logic change |`

**Step 4: Commit**

```bash
git add PROJECT_REFERENCE.md
git commit -m "docs: update PROJECT_REFERENCE.md with Foodics integration details"
```

---

## Task 11: End-to-End Testing

**Step 1: Test webhook endpoint**

```bash
# طلب جديد — يجب أن ينشئ الطلب
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/foodics-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"order.created","data":{"id":"test-001","number":5001,"type":2,"branch":{"id":"<FOODICS_BRANCH_ID>"}}}'
# Expected: {"status":"created","order_id":"<uuid>"}

# نفس الطلب مرة ثانية — يجب أن يتجاهله
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/foodics-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"order.created","data":{"id":"test-001","number":5001,"type":2,"branch":{"id":"<FOODICS_BRANCH_ID>"}}}'
# Expected: {"status":"duplicate","foodics_order_id":"test-001"}

# حدث غير مدعوم — يجب أن يتجاهله
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/foodics-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"order.updated","data":{"id":"test-002"}}'
# Expected: {"status":"ignored","event":"order.updated"}
```

**Step 2: Test Realtime**

1. افتح `/display?branch=Erqaa-01` في المتصفح
2. أرسل curl webhook → الطلب يظهر فوراً على الشاشة

**Step 3: Test QR Scan**

1. افتح `/scan?branch=Erqaa-01`
2. امسح QR لطلب موجود (status: preparing) → يتحول لجاهز
3. امسح نفس QR مرة ثانية → "الطلب جاهز بالفعل"
4. امسح QR لطلب غير موجود → "الطلب غير موجود في النظام"

**Step 4: Cleanup test data**

```sql
DELETE FROM orders WHERE foodics_order_id LIKE 'test-%';
```

---

## Execution Order Summary

```
Task 1:  DB — foodics_config + foodics_branch_mapping tables
Task 2:  DB — ALTER orders (add Foodics columns)
Task 3:  DB — ALTER scan_logs (add ready_scan)
Task 4:  Edge Function — foodics-webhook
Task 5:  Seed — branch mapping data
Task 6:  Frontend — useScanner.js (scan = ready only)
Task 7:  Frontend — Scanner.jsx (not_found handling)
Task 8:  Frontend — OrderCard.jsx (show source + type)
Task 9:  Config — env vars + Foodics OAuth + webhook registration
Task 10: Docs — update PROJECT_REFERENCE.md
Task 11: Testing — end-to-end verification
```

Dependencies: Tasks 1-3 are independent. Task 4 depends on 1-2. Task 5 depends on 1. Tasks 6-8 are independent of 4-5. Task 9 is manual setup. Task 10-11 are last.
