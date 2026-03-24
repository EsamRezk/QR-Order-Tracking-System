CREATE TABLE scan_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) NOT NULL,
  scan_type TEXT CHECK (scan_type IN ('first_scan', 'second_scan')) NOT NULL,
  scanned_by TEXT,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  device_info TEXT
);
