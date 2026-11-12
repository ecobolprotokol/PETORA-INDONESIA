UPDATE access_permissions
SET supports_own_scope = true
WHERE key = 'branches.read';
