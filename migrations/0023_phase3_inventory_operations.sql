ALTER TABLE document_number_sequences
  DROP CONSTRAINT document_number_sequences_document_type_check,
  ADD CONSTRAINT document_number_sequences_document_type_check
    CHECK (document_type IN (
      'invoice', 'purchase_request', 'purchase_order', 'inventory_transfer',
      'goods_receipt', 'supplier_return', 'receipt'
    ));

INSERT INTO document_number_sequences (document_type, prefix, next_number)
VALUES
  ('inventory_transfer', 'TRF', 1),
  ('goods_receipt', 'GRN', 1),
  ('supplier_return', 'SRN', 1)
ON CONFLICT DO NOTHING;

ALTER TABLE inventory_batches
  ADD COLUMN supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT;

CREATE TABLE inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  created_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_adjustments_warehouse_created_idx
  ON inventory_adjustments (warehouse_id, created_at);

CREATE TABLE inventory_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text NOT NULL UNIQUE,
  source_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  destination_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'in_transit', 'received', 'cancelled')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  requested_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
  shipped_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  received_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  shipped_at timestamptz,
  received_at timestamptz,
  CONSTRAINT inventory_transfer_distinct_warehouses
    CHECK (source_warehouse_id <> destination_warehouse_id)
);

CREATE INDEX inventory_transfers_source_status_idx
  ON inventory_transfers (source_warehouse_id, status);
CREATE INDEX inventory_transfers_destination_status_idx
  ON inventory_transfers (destination_warehouse_id, status);

CREATE TABLE inventory_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id uuid NOT NULL REFERENCES inventory_transfers(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0)
);

CREATE INDEX inventory_transfer_lines_transfer_idx ON inventory_transfer_lines (transfer_id);

CREATE TABLE inventory_transfer_batch_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_line_id uuid NOT NULL REFERENCES inventory_transfer_lines(id) ON DELETE RESTRICT,
  source_batch_id uuid NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  destination_batch_id uuid NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  shipped_quantity numeric(14, 3) NOT NULL CHECK (shipped_quantity > 0),
  received_quantity numeric(14, 3) NOT NULL DEFAULT 0
    CHECK (received_quantity >= 0 AND received_quantity <= shipped_quantity),
  CONSTRAINT inventory_transfer_batch_unique UNIQUE (transfer_line_id, source_batch_id)
);

CREATE INDEX inventory_transfer_batch_transfer_line_idx
  ON inventory_transfer_batch_lines (transfer_line_id);

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
