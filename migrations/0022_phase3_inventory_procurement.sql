ALTER TABLE business_settings
  ADD COLUMN inventory_cost_method text NOT NULL DEFAULT 'fifo'
    CHECK (inventory_cost_method IN ('average', 'fifo'));

ALTER TABLE document_number_sequences
  DROP CONSTRAINT document_number_sequences_document_type_check,
  ADD CONSTRAINT document_number_sequences_document_type_check
    CHECK (document_type IN ('invoice', 'purchase_request', 'purchase_order', 'receipt'));

INSERT INTO document_number_sequences (document_type, prefix, next_number)
VALUES ('purchase_request', 'PR', 1)
ON CONFLICT DO NOTHING;

CREATE TABLE warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 20),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX warehouses_branch_code_lower_unique
  ON warehouses (branch_id, lower(code));
CREATE INDEX warehouses_branch_active_idx ON warehouses (branch_id, is_active);

CREATE FUNCTION create_default_warehouse_for_branch() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO warehouses (branch_id, code, name, created_by)
  VALUES (NEW.id, 'MAIN', 'Gudang Utama', NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER branches_create_default_warehouse
AFTER INSERT ON branches
FOR EACH ROW EXECUTE FUNCTION create_default_warehouse_for_branch();

INSERT INTO warehouses (branch_id, code, name, created_by)
SELECT id, 'MAIN', 'Gudang Utama', created_by
FROM branches
ON CONFLICT DO NOTHING;

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  contact_name text CHECK (contact_name IS NULL OR length(contact_name) <= 120),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  email text CHECK (email IS NULL OR length(email) <= 254),
  address text CHECK (address IS NULL OR length(address) <= 500),
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX suppliers_name_lower_unique ON suppliers (lower(name));
CREATE INDEX suppliers_active_name_idx ON suppliers (is_active, lower(name));

CREATE TABLE inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  batch_number text NOT NULL CHECK (length(trim(batch_number)) BETWEEN 1 AND 100),
  expires_on date,
  unit_cost_cents bigint NOT NULL CHECK (unit_cost_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_batches_lot_unique
    UNIQUE NULLS NOT DISTINCT (warehouse_id, product_id, variant_id, batch_number)
);

CREATE INDEX inventory_batches_fefo_idx
  ON inventory_batches (warehouse_id, product_id, variant_id, expires_on, created_at);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  movement_type text NOT NULL CHECK (movement_type IN (
    'receipt', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out',
    'supplier_return', 'bundle_component_in', 'bundle_component_out'
  )),
  quantity_delta numeric(14, 3) NOT NULL CHECK (quantity_delta <> 0),
  unit_cost_cents bigint NOT NULL CHECK (unit_cost_cents >= 0),
  source_type text NOT NULL CHECK (length(source_type) BETWEEN 1 AND 40),
  source_id uuid NOT NULL,
  reason text CHECK (reason IS NULL OR length(reason) <= 500),
  actor_user_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movement_sign_check CHECK (
    (movement_type IN ('receipt', 'adjustment_in', 'transfer_in', 'bundle_component_in')
      AND quantity_delta > 0)
    OR
    (movement_type IN ('adjustment_out', 'transfer_out', 'supplier_return', 'bundle_component_out')
      AND quantity_delta < 0)
  )
);

CREATE INDEX inventory_movements_warehouse_product_idx
  ON inventory_movements (warehouse_id, product_id, created_at);
CREATE INDEX inventory_movements_batch_created_idx ON inventory_movements (batch_id, created_at);
CREATE UNIQUE INDEX inventory_movements_source_unique
  ON inventory_movements (source_type, source_id, batch_id, movement_type);

CREATE FUNCTION prevent_inventory_movement_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'inventory movements are immutable';
END;
$$;

CREATE TRIGGER inventory_movements_immutable
BEFORE UPDATE OR DELETE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION prevent_inventory_movement_mutation();

CREATE TABLE product_bundle_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  component_variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  CONSTRAINT product_bundle_component_not_self CHECK (bundle_product_id <> component_product_id),
  CONSTRAINT product_bundle_components_unique
    UNIQUE NULLS NOT DISTINCT (bundle_product_id, component_product_id, component_variant_id)
);

CREATE INDEX product_bundle_components_component_idx
  ON product_bundle_components (component_product_id, component_variant_id);

CREATE TABLE purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  request_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'converted')),
  requested_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX purchase_requests_branch_status_idx
  ON purchase_requests (branch_id, status, created_at);

CREATE TABLE purchase_request_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  estimated_unit_cost_cents bigint CHECK (
    estimated_unit_cost_cents IS NULL OR estimated_unit_cost_cents >= 0
  )
);

CREATE INDEX purchase_request_lines_request_idx ON purchase_request_lines (request_id);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  request_id uuid REFERENCES purchase_requests(id) ON DELETE RESTRICT,
  order_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  ordered_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_orders_request_unique UNIQUE (request_id)
);

CREATE INDEX purchase_orders_branch_status_idx
  ON purchase_orders (branch_id, status, created_at);
CREATE INDEX purchase_orders_supplier_idx ON purchase_orders (supplier_id, created_at);

CREATE TABLE purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  received_quantity numeric(14, 3) NOT NULL DEFAULT 0
    CHECK (received_quantity >= 0 AND received_quantity <= quantity),
  unit_cost_cents bigint NOT NULL CHECK (unit_cost_cents >= 0)
);

CREATE INDEX purchase_order_lines_order_idx ON purchase_order_lines (order_id);

CREATE TABLE purchase_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  receipt_number text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  received_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text CHECK (notes IS NULL OR length(notes) <= 2000)
);

CREATE INDEX purchase_receipts_order_idx ON purchase_receipts (order_id, received_at);

CREATE TABLE purchase_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES purchase_receipts(id) ON DELETE RESTRICT,
  order_line_id uuid NOT NULL REFERENCES purchase_order_lines(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  unit_cost_cents bigint NOT NULL CHECK (unit_cost_cents >= 0)
);

CREATE INDEX purchase_receipt_lines_receipt_idx ON purchase_receipt_lines (receipt_id);

CREATE TABLE supplier_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  return_number text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX supplier_returns_supplier_idx ON supplier_returns (supplier_id, created_at);

CREATE TABLE supplier_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES supplier_returns(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  unit_cost_cents bigint NOT NULL CHECK (unit_cost_cents >= 0)
);

CREATE INDEX supplier_return_lines_return_idx ON supplier_return_lines (return_id);

CREATE TABLE supplier_payable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  entry_type text NOT NULL CHECK (entry_type IN ('receipt', 'return', 'payment', 'adjustment')),
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payable_source_unique UNIQUE (source_type, source_id)
);

CREATE INDEX supplier_payable_supplier_date_idx
  ON supplier_payable_entries (supplier_id, created_at);
CREATE INDEX supplier_payable_branch_date_idx
  ON supplier_payable_entries (branch_id, created_at);

CREATE TABLE stocktakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  reviewed_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE INDEX stocktakes_warehouse_status_idx ON stocktakes (warehouse_id, status);

CREATE TABLE stocktake_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id uuid NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  expected_quantity numeric(14, 3) NOT NULL CHECK (expected_quantity >= 0),
  counted_quantity numeric(14, 3) NOT NULL CHECK (counted_quantity >= 0),
  CONSTRAINT stocktake_lines_batch_unique UNIQUE (stocktake_id, batch_id)
);

CREATE INDEX stocktake_lines_stocktake_idx ON stocktake_lines (stocktake_id);

INSERT INTO access_permissions (key, description, branch_scoped, supports_own_scope, high_risk)
VALUES
  ('inventory.read', 'Melihat stok, batch, dan kartu stok per cabang', true, false, false),
  ('inventory.manage', 'Mengelola gudang dan stok masuk/keluar', true, false, true),
  ('inventory.adjust', 'Menyesuaikan stok dan mengesahkan opname', true, false, true),
  ('inventory.transfer', 'Meminta, mengirim, dan menerima transfer stok', true, false, true),
  ('inventory.approve', 'Menyetujui opname dan perubahan stok', true, false, true),
  ('inventory.cost.read', 'Melihat nilai persediaan dan HPP', true, false, true),
  ('procurement.read', 'Melihat permintaan, pesanan, dan penerimaan pembelian', true, false, false),
  ('procurement.manage', 'Mengelola permintaan dan pesanan pembelian', true, false, true),
  ('procurement.approve', 'Menyetujui permintaan pembelian', true, false, true),
  ('suppliers.manage', 'Mengelola data supplier global', false, false, true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  branch_scoped = EXCLUDED.branch_scoped,
  supports_own_scope = EXCLUDED.supports_own_scope,
  high_risk = EXCLUDED.high_risk;
