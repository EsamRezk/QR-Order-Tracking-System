-- Enable pgcrypto for bcrypt password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  branch_id UUID REFERENCES branches(id),
  route TEXT NOT NULL DEFAULT '/scan',
  role TEXT CHECK (role IN ('admin', 'user', 'screen')) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-hash passwords on INSERT or UPDATE using bcrypt
CREATE OR REPLACE FUNCTION hash_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Only hash if password is new or changed
  IF TG_OP = 'INSERT' OR NEW.password != OLD.password THEN
    NEW.password := crypt(NEW.password, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hash_password
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION hash_password();
