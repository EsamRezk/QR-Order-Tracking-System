-- Seed the first admin user (password will be auto-hashed by trigger)
-- Username: admin | Password: admin123
-- ⚠️ IMPORTANT: Change this password immediately after first login
INSERT INTO users (username, password, route, role)
VALUES ('KebbaZone', 'Kebba@#@2026@', '/analytics', 'admin');
