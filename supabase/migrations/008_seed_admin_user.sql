-- Seed the first admin user (password will be auto-hashed by trigger)
INSERT INTO users (username, password, route, role)
VALUES ('Esam', 'Erezk@123', '/analytics', 'admin');
