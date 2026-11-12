INSERT INTO access_permissions (key, description, branch_scoped, supports_own_scope, high_risk)
VALUES (
  'procurement.cost.read',
  'Melihat biaya pembelian dan saldo hutang supplier per cabang',
  true,
  false,
  true
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  branch_scoped = EXCLUDED.branch_scoped,
  supports_own_scope = EXCLUDED.supports_own_scope,
  high_risk = EXCLUDED.high_risk;
