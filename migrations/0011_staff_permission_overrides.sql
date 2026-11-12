CREATE TABLE staff_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES access_permissions(key) ON DELETE RESTRICT,
  branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT,
  effect text NOT NULL CHECK (effect IN ('allow', 'deny')),
  data_scope text NOT NULL DEFAULT 'all' CHECK (data_scope IN ('all', 'own')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX staff_permission_overrides_global_unique
  ON staff_permission_overrides (staff_user_id, permission_key)
  WHERE branch_id IS NULL;
CREATE UNIQUE INDEX staff_permission_overrides_branch_unique
  ON staff_permission_overrides (staff_user_id, permission_key, branch_id)
  WHERE branch_id IS NOT NULL;
CREATE INDEX staff_permission_overrides_staff_permission_idx
  ON staff_permission_overrides (staff_user_id, permission_key);
