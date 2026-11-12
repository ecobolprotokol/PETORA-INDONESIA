CREATE TABLE access_permissions (
  key text PRIMARY KEY,
  description text NOT NULL,
  branch_scoped boolean NOT NULL,
  supports_own_scope boolean NOT NULL DEFAULT false
);

INSERT INTO access_permissions (key, description, branch_scoped, supports_own_scope)
VALUES
  ('branches.read', 'Melihat cabang yang ditugaskan', true, false),
  ('branches.manage', 'Membuat cabang baru', false, false);

CREATE TABLE access_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX access_roles_name_lower_unique ON access_roles (lower(name));

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES access_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES access_permissions(key) ON DELETE RESTRICT,
  data_scope text NOT NULL DEFAULT 'all' CHECK (data_scope IN ('all', 'own')),
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE staff_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES access_roles(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT,
  assigned_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX staff_role_assignment_global_unique
  ON staff_role_assignments (staff_user_id, role_id)
  WHERE branch_id IS NULL;
CREATE UNIQUE INDEX staff_role_assignment_branch_unique
  ON staff_role_assignments (staff_user_id, role_id, branch_id)
  WHERE branch_id IS NOT NULL;
CREATE INDEX staff_role_assignment_staff_idx
  ON staff_role_assignments (staff_user_id, branch_id);
CREATE INDEX role_permissions_permission_idx
  ON role_permissions (permission_key, role_id);
