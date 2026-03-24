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
