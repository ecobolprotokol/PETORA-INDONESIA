ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS max_discount_bps integer CHECK (max_discount_bps BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS max_refund_cents bigint CHECK (max_refund_cents BETWEEN 0 AND 999999999999),
  ADD COLUMN IF NOT EXISTS max_void_cents bigint CHECK (max_void_cents BETWEEN 0 AND 999999999999),
  ADD COLUMN IF NOT EXISTS max_transfer_cents bigint CHECK (max_transfer_cents BETWEEN 0 AND 999999999999),
  ADD COLUMN IF NOT EXISTS requires_supervisor_pin boolean NOT NULL DEFAULT false;

ALTER TABLE staff_permission_overrides
  ADD COLUMN IF NOT EXISTS max_discount_bps integer CHECK (max_discount_bps BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS max_refund_cents bigint CHECK (max_refund_cents BETWEEN 0 AND 999999999999),
  ADD COLUMN IF NOT EXISTS max_void_cents bigint CHECK (max_void_cents BETWEEN 0 AND 999999999999),
  ADD COLUMN IF NOT EXISTS max_transfer_cents bigint CHECK (max_transfer_cents BETWEEN 0 AND 999999999999),
  ADD COLUMN IF NOT EXISTS requires_supervisor_pin boolean NOT NULL DEFAULT false;