CREATE TABLE inventory_reorder_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES product_variants(id) ON DELETE RESTRICT,
  minimum_quantity numeric(14, 3) NOT NULL CHECK (minimum_quantity > 0),
  reorder_quantity numeric(14, 3) NOT NULL CHECK (reorder_quantity > 0),
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_reorder_levels_scope_unique
    UNIQUE NULLS NOT DISTINCT (warehouse_id, product_id, variant_id)
);

CREATE INDEX inventory_reorder_levels_warehouse_idx
  ON inventory_reorder_levels (warehouse_id, product_id);
