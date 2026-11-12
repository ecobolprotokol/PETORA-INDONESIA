ALTER TABLE document_number_sequences
  DROP CONSTRAINT document_number_sequences_document_type_check,
  ADD CONSTRAINT document_number_sequences_document_type_check
    CHECK (document_type IN (
      'invoice', 'purchase_request', 'purchase_order', 'inventory_transfer',
      'goods_receipt', 'supplier_return', 'receipt'
    ));

CREATE TABLE pos_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  cashier_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_cash_cents bigint NOT NULL CHECK (opening_cash_cents >= 0),
  closing_cash_cents bigint CHECK (closing_cash_cents IS NULL OR closing_cash_cents >= 0),
  expected_cash_cents bigint CHECK (expected_cash_cents IS NULL OR expected_cash_cents >= 0),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  close_notes text CHECK (close_notes IS NULL OR length(close_notes) <= 1000),
  CONSTRAINT pos_shift_close_state_check CHECK (
    (status = 'open' AND closed_at IS NULL AND closing_cash_cents IS NULL)
    OR (status = 'closed' AND closed_at IS NOT NULL AND closing_cash_cents IS NOT NULL)
  )
);
CREATE UNIQUE INDEX pos_shifts_one_open_per_cashier_idx
  ON pos_shifts (branch_id, cashier_id) WHERE status = 'open';
CREATE UNIQUE INDEX pos_shifts_one_open_per_warehouse_idx
  ON pos_shifts (warehouse_id, cashier_id) WHERE status = 'open';
CREATE INDEX pos_shifts_branch_status_idx ON pos_shifts (branch_id, status, opened_at DESC);

CREATE TABLE pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  shift_id uuid NOT NULL REFERENCES pos_shifts(id) ON DELETE RESTRICT,
  cashier_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  pet_id uuid REFERENCES pets(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('held', 'paid', 'partially_paid', 'voided', 'refunded')),
  subtotal_cents bigint NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents bigint NOT NULL CHECK (discount_cents >= 0),
  tax_cents bigint NOT NULL CHECK (tax_cents >= 0),
  total_cents bigint NOT NULL CHECK (total_cents >= 0),
  paid_cents bigint NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  refunded_cents bigint NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  tax_rate_bps integer NOT NULL CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  tax_included boolean NOT NULL,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_sales_amount_check CHECK (
    total_cents = subtotal_cents - discount_cents
      + CASE WHEN tax_included THEN 0 ELSE tax_cents END
    AND paid_cents <= total_cents
    AND refunded_cents <= paid_cents
  )
);
CREATE INDEX pos_sales_branch_date_idx ON pos_sales (branch_id, created_at DESC);
CREATE INDEX pos_sales_shift_status_idx ON pos_sales (shift_id, status, created_at DESC);
CREATE INDEX pos_sales_customer_idx ON pos_sales (customer_id, created_at DESC);

CREATE TABLE pos_sale_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES pos_sales(id) ON DELETE RESTRICT,
  item_type text NOT NULL CHECK (item_type IN ('product', 'service')),
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES services(id) ON DELETE RESTRICT,
  item_name text NOT NULL CHECK (length(item_name) BETWEEN 1 AND 200),
  item_sku text NOT NULL CHECK (length(item_sku) <= 80),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0),
  discount_cents bigint NOT NULL CHECK (discount_cents >= 0),
  tax_cents bigint NOT NULL CHECK (tax_cents >= 0),
  line_total_cents bigint NOT NULL CHECK (line_total_cents >= 0),
  returned_quantity numeric(14, 3) NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
  notes text CHECK (notes IS NULL OR length(notes) <= 500),
  CONSTRAINT pos_sale_line_item_check CHECK (
    (item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL)
    OR (item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL AND variant_id IS NULL)
  ),
  CONSTRAINT pos_sale_line_discount_check CHECK (discount_cents <= unit_price_cents * quantity)
);
CREATE INDEX pos_sale_lines_sale_idx ON pos_sale_lines (sale_id);

CREATE TABLE pos_sale_stock_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_line_id uuid NOT NULL REFERENCES pos_sale_lines(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  UNIQUE (sale_line_id, batch_id)
);

CREATE TABLE pos_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES pos_sales(id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (
    method IN ('cash', 'bank_transfer', 'card', 'qris', 'ewallet', 'virtual_account', 'deposit')
  ),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reference text CHECK (reference IS NULL OR length(reference) <= 120),
  received_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pos_payments_sale_idx ON pos_payments (sale_id, created_at);

CREATE TABLE pos_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  sale_id uuid NOT NULL REFERENCES pos_sales(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pos_refunds_sale_idx ON pos_refunds (sale_id, created_at);

CREATE TABLE pos_refund_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES pos_refunds(id) ON DELETE RESTRICT,
  sale_line_id uuid NOT NULL REFERENCES pos_sale_lines(id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0)
);
CREATE INDEX pos_refund_lines_sale_line_idx ON pos_refund_lines (sale_line_id);

CREATE TABLE pos_refund_stock_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_line_id uuid NOT NULL REFERENCES pos_refund_lines(id) ON DELETE RESTRICT,
  sale_line_id uuid NOT NULL REFERENCES pos_sale_lines(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0)
);

CREATE TABLE pos_refund_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES pos_refunds(id) ON DELETE RESTRICT,
  method text NOT NULL CHECK (
    method IN ('cash', 'bank_transfer', 'card', 'qris', 'ewallet', 'virtual_account', 'deposit')
  ),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pos_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES pos_shifts(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN ('cash_in', 'cash_out')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pos_cash_movements_shift_idx ON pos_cash_movements (shift_id, created_at);

ALTER TABLE inventory_movements
  DROP CONSTRAINT inventory_movements_movement_type_check,
  ADD CONSTRAINT inventory_movements_movement_type_check CHECK (movement_type IN (
    'receipt', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out',
    'supplier_return', 'bundle_component_in', 'bundle_component_out', 'sale_out', 'sale_return_in'
  )),
  DROP CONSTRAINT inventory_movement_sign_check,
  ADD CONSTRAINT inventory_movement_sign_check CHECK (
    (movement_type IN ('receipt', 'adjustment_in', 'transfer_in', 'bundle_component_in', 'sale_return_in')
      AND quantity_delta > 0)
    OR
    (movement_type IN ('adjustment_out', 'transfer_out', 'supplier_return', 'bundle_component_out', 'sale_out')
      AND quantity_delta < 0)
  );

INSERT INTO access_permissions (key, description, branch_scoped, supports_own_scope, high_risk)
VALUES
  ('pos.read', 'Melihat shift dan penjualan pada cabang', true, false, false),
  ('pos.manage', 'Mengelola shift, kasir, dan penjualan pada cabang', true, false, true),
  ('pos.refund', 'Membatalkan penjualan dan memproses refund pada cabang', true, false, true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  branch_scoped = EXCLUDED.branch_scoped,
  supports_own_scope = EXCLUDED.supports_own_scope,
  high_risk = EXCLUDED.high_risk;
