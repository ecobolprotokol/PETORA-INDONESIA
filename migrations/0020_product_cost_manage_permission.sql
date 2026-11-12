INSERT INTO access_permissions (key, description, branch_scoped, supports_own_scope, high_risk)
VALUES (
  'products.cost.manage',
  'Mengubah harga beli produk',
  false,
  true,
  true
)
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description,
    branch_scoped = EXCLUDED.branch_scoped,
    supports_own_scope = EXCLUDED.supports_own_scope,
    high_risk = EXCLUDED.high_risk;
