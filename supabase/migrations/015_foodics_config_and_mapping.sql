-- ═══════════════════════════════════════════════════
-- 015: Foodics config + branch mapping tables
-- ═══════════════════════════════════════════════════
-- RLS مفعّل بدون policies على الجدولين → لا وصول مباشر من العميل (anon).
-- الوصول فقط عبر Edge Function باستخدام service_role key (يتخطى RLS).

-- بيانات الاتصال بـ Foodics (token + base URL)
-- webhook_secret غير مستخدم (فوديكس لا ترسل توقيعاً) — نبقيه للتوافق فقط.
-- api_base_url: Sandbox افتراضياً؛ غيّره لـ https://api.foodics.com/v5 عند الإنتاج.
CREATE TABLE IF NOT EXISTS foodics_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    TEXT,
  access_token   TEXT NOT NULL,
  api_base_url   TEXT NOT NULL DEFAULT 'https://api-sandbox.foodics.com/v5',
  webhook_secret TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE foodics_config ENABLE ROW LEVEL SECURITY;

-- ربط كل فرع في Foodics بالفرع المقابل في نظامنا
CREATE TABLE IF NOT EXISTS foodics_branch_mapping (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foodics_branch_id TEXT UNIQUE NOT NULL,
  branch_id         UUID NOT NULL REFERENCES branches(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE foodics_branch_mapping ENABLE ROW LEVEL SECURITY;
