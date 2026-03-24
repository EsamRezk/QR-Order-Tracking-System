-- Enable Realtime on orders table
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Row Level Security policies (MVP: open access)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON scan_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read branches" ON branches FOR SELECT USING (true);
CREATE POLICY "Allow insert branches" ON branches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update branches" ON branches FOR UPDATE USING (true) WITH CHECK (true);
