ALTER TABLE access_permissions
  ADD COLUMN high_risk boolean NOT NULL DEFAULT false;

INSERT INTO access_permissions (key, description, branch_scoped, supports_own_scope, high_risk)
VALUES
  ('access.manage', 'Mengelola staf, peran, penugasan, dan pengecualian izin', false, false, true),
  ('audit.read', 'Melihat log audit yang berisi aktivitas sensitif', false, false, true),
  ('settings.manage', 'Mengubah pengaturan bisnis dan penomoran dokumen', false, false, true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  branch_scoped = EXCLUDED.branch_scoped,
  supports_own_scope = EXCLUDED.supports_own_scope,
  high_risk = EXCLUDED.high_risk;

UPDATE access_permissions
SET high_risk = true
WHERE key IN ('branches.manage');
