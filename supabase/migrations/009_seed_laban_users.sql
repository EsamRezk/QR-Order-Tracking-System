-- Seed user and screen accounts for Laban branch
-- Passwords will be auto-hashed by trigger (bcrypt)

-- User: Laban (role=user, route=/scan)
INSERT INTO users (username, password, branch_id, route, role)
VALUES (
  'Laban',
  'Laban@2025',
  (SELECT id FROM branches WHERE code = 'Laban-02' LIMIT 1),
  '/scan',
  'user'
);

-- Screen: LabanScreen (role=screen, route=/display)
INSERT INTO users (username, password, branch_id, route, role)
VALUES (
  'LabanScreen',
  'Laban@2025',
  (SELECT id FROM branches WHERE code = 'Laban-02' LIMIT 1),
  '/display',
  'screen'
);
