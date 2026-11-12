ALTER TABLE document_number_sequences
  DROP CONSTRAINT document_number_sequences_document_type_check,
  ADD CONSTRAINT document_number_sequences_document_type_check CHECK (document_type IN (
    'invoice', 'purchase_request', 'purchase_order', 'inventory_transfer',
    'goods_receipt', 'supplier_return', 'receipt', 'refund', 'voucher'
  ));

CREATE TABLE pos_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'buy_x_get_y')),
  discount_value numeric(14, 3) NOT NULL CHECK (discount_value > 0),
  min_purchase_cents bigint CHECK (min_purchase_cents IS NULL OR min_purchase_cents >= 0),
  max_discount_cents bigint CHECK (max_discount_cents IS NULL OR max_discount_cents >= 0),
  applies_to text NOT NULL CHECK (applies_to IN ('all', 'products', 'services', 'categories', 'specific')),
  target_ids uuid[] NOT NULL DEFAULT '{}',
  price_tier_id uuid REFERENCES price_tiers(id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority smallint NOT NULL DEFAULT 0,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_promotion_date_order CHECK (starts_at < ends_at),
  CONSTRAINT pos_promotion_buy_x_get_y CHECK (
    discount_type <> 'buy_x_get_y' OR (discount_value % 1 = 0 AND discount_value >= 1)
  )
);
CREATE INDEX pos_promotions_branch_active_idx ON pos_promotions (branch_id, is_active, starts_at, ends_at) WHERE is_active;
CREATE INDEX pos_promotions_date_range_idx ON pos_promotions (starts_at, ends_at);

CREATE TABLE pos_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value numeric(14, 3) NOT NULL CHECK (discount_value > 0),
  min_purchase_cents bigint CHECK (min_purchase_cents IS NULL OR min_purchase_cents >= 0),
  max_discount_cents bigint CHECK (max_discount_cents IS NULL OR max_discount_cents >= 0),
  applies_to text NOT NULL CHECK (applies_to IN ('all', 'products', 'services', 'categories', 'specific')),
  target_ids uuid[] NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  per_customer_limit integer CHECK (per_customer_limit IS NULL OR per_customer_limit > 0),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_voucher_date_order CHECK (starts_at < ends_at)
);
CREATE UNIQUE INDEX pos_vouchers_code_branch_unique ON pos_vouchers (branch_id, lower(code));
CREATE INDEX pos_vouchers_branch_active_idx ON pos_vouchers (branch_id, is_active, starts_at, ends_at) WHERE is_active;

CREATE TABLE pos_voucher_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES pos_vouchers(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  sale_id uuid NOT NULL REFERENCES pos_sales(id) ON DELETE RESTRICT,
  discount_cents bigint NOT NULL CHECK (discount_cents >= 0),
  used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pos_voucher_usages_voucher_idx ON pos_voucher_usages (voucher_id, used_at);
CREATE INDEX pos_voucher_usages_customer_idx ON pos_voucher_usages (customer_id, used_at);

CREATE TABLE loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  points_balance integer NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  tier text NOT NULL DEFAULT 'member' CHECK (tier IN ('member', 'silver', 'gold', 'platinum')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX loyalty_accounts_customer_branch_unique ON loyalty_accounts (customer_id, branch_id);
CREATE INDEX loyalty_accounts_branch_idx ON loyalty_accounts (branch_id, tier);

CREATE TABLE loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES loyalty_accounts(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('earn', 'redeem', 'expire', 'adjust', 'refund')),
  points integer NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  source_type text NOT NULL CHECK (source_type IN ('pos_sale', 'manual', 'promotion', 'voucher', 'system')),
  source_id uuid,
  reason text,
  actor_user_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_transactions_account_idx ON loyalty_transactions (account_id, created_at DESC);
CREATE INDEX loyalty_transactions_source_idx ON loyalty_transactions (source_type, source_id);

CREATE TABLE loyalty_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (name IN ('member', 'silver', 'gold', 'platinum')),
  min_points integer NOT NULL CHECK (min_points >= 0),
  earn_rate_bps integer NOT NULL CHECK (earn_rate_bps BETWEEN 0 AND 10000),
  redeem_rate_bps integer NOT NULL CHECK (redeem_rate_bps BETWEEN 0 AND 10000),
  min_redeem_points integer NOT NULL DEFAULT 0 CHECK (min_redeem_points >= 0),
  benefits jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX loyalty_tiers_branch_name_unique ON loyalty_tiers (branch_id, name);

CREATE TABLE customer_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  balance_cents bigint NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customer_deposits_customer_branch_unique ON customer_deposits (customer_id, branch_id);
CREATE INDEX customer_deposits_branch_idx ON customer_deposits (branch_id, balance_cents DESC);

CREATE TABLE customer_deposit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES customer_deposits(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('topup', 'payment', 'refund', 'adjust', 'transfer_in', 'transfer_out')),
  amount_cents bigint NOT NULL,
  balance_after_cents bigint NOT NULL CHECK (balance_after_cents >= 0),
  source_type text NOT NULL CHECK (source_type IN ('pos_sale', 'pos_refund', 'manual', 'transfer', 'system')),
  source_id uuid,
  reference text,
  actor_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_deposit_transactions_deposit_idx ON customer_deposit_transactions (deposit_id, created_at DESC);
CREATE INDEX customer_deposit_transactions_source_idx ON customer_deposit_transactions (source_type, source_id);

INSERT INTO document_number_sequences (document_type, prefix, next_number)
VALUES ('voucher', 'VCH', 1)
ON CONFLICT DO NOTHING;

INSERT INTO access_permissions (key, description, branch_scoped, supports_own_scope, high_risk)
VALUES
  ('pos.promotions.manage', 'Mengelola promo otomatis pada cabang', true, false, true),
  ('pos.vouchers.manage', 'Mengelola voucher pada cabang', true, false, true),
  ('loyalty.manage', 'Mengelola program loyalitas pada cabang', true, false, true),
  ('customers.deposit.manage', 'Mengelola saldo deposit pelanggan pada cabang', true, false, true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  branch_scoped = EXCLUDED.branch_scoped,
  supports_own_scope = EXCLUDED.supports_own_scope,
  high_risk = EXCLUDED.high_risk;