-- ============================================================
-- QR Order Tracking System - Supabase Database Schema
-- Contract: Database tables, RLS policies, and realtime config
-- ============================================================

-- 1. Branches table
CREATE TABLE branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  location_label TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Orders table
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id) NOT NULL,
  channel_link TEXT,
  status TEXT CHECK (status IN ('preparing', 'ready', 'completed')) DEFAULT 'preparing',
  scanned_at TIMESTAMPTZ DEFAULT now(),
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  prep_duration_seconds INTEGER GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (ready_at - scanned_at))
  ) STORED,
  raw_qr_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id, branch_id)
);

-- 3. Scan logs table
CREATE TABLE scan_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) NOT NULL,
  scan_type TEXT CHECK (scan_type IN ('first_scan', 'second_scan')) NOT NULL,
  scanned_by TEXT,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  device_info TEXT
);

-- 4. Enable Realtime on orders table
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- 5. Row Level Security policies (MVP: open access)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON scan_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read branches" ON branches FOR SELECT USING (true);

-- 6. Seed data (initial 3 branches)
INSERT INTO branches (name_ar, name_en, code, location_label) VALUES
  ('عرقه', 'Erqaa', 'Erqaa-01', 'Erqaa'),
  ('ظهرة لبن', 'Laban', 'Laban-02', 'Laban'),
  ('الملقا', 'Al-Malqa', 'AlMalqa-03', 'AlMalqa');
