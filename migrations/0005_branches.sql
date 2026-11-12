CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL CHECK (code = upper(code) AND code ~ '^[A-Z0-9][A-Z0-9_-]{1,11}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  timezone text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX branches_code_lower_unique ON branches (lower(code));
CREATE INDEX branches_active_name_idx ON branches (name) WHERE is_active;
