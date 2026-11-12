ALTER TABLE inventory_batches
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE RESTRICT;
