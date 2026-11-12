CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (length(trim(phone)) BETWEEN 8 AND 24),
  email text CHECK (email IS NULL OR length(email) <= 254),
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customers_created_by_created_at_idx ON customers (created_by, created_at DESC);
CREATE INDEX customers_name_search_idx ON customers (lower(name));

INSERT INTO access_permissions (key, description, branch_scoped, supports_own_scope, high_risk)
VALUES
  ('customers.read', 'Melihat data kontak pelanggan', false, true, true),
  ('customers.manage', 'Membuat dan mengubah data pelanggan', false, true, true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  branch_scoped = EXCLUDED.branch_scoped,
  supports_own_scope = EXCLUDED.supports_own_scope,
  high_risk = EXCLUDED.high_risk;
