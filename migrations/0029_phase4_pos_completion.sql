ALTER TABLE pos_payments
  ADD COLUMN shift_id uuid REFERENCES pos_shifts(id) ON DELETE RESTRICT,
  ADD COLUMN idempotency_key text;

UPDATE pos_payments AS payment
SET shift_id = sale.shift_id,
    idempotency_key = 'legacy:' || payment.id::text
FROM pos_sales AS sale
WHERE payment.sale_id = sale.id;

ALTER TABLE pos_payments
  ALTER COLUMN shift_id SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL,
  ADD CONSTRAINT pos_payments_idempotency_key_check
    CHECK (length(idempotency_key) BETWEEN 8 AND 160);
CREATE UNIQUE INDEX pos_payments_idempotency_key_unique
  ON pos_payments (idempotency_key);
CREATE INDEX pos_payments_shift_method_idx
  ON pos_payments (shift_id, method);

ALTER TABLE pos_refunds
  ADD COLUMN shift_id uuid REFERENCES pos_shifts(id) ON DELETE RESTRICT;

UPDATE pos_refunds AS refund
SET shift_id = sale.shift_id
FROM pos_sales AS sale
WHERE refund.sale_id = sale.id;

ALTER TABLE pos_refunds
  ALTER COLUMN shift_id SET NOT NULL;
CREATE INDEX pos_refunds_shift_idx ON pos_refunds (shift_id, created_at);

ALTER TABLE pos_sales
  ADD COLUMN void_idempotency_key text,
  ADD COLUMN resume_idempotency_key text,
  ADD COLUMN void_reason text,
  ADD COLUMN voided_by uuid REFERENCES staff_users(id) ON DELETE RESTRICT,
  ADD COLUMN voided_at timestamptz;

ALTER TABLE pos_sales
  ADD CONSTRAINT pos_sales_void_state_check CHECK (
    (status = 'voided'
      AND void_idempotency_key IS NOT NULL
      AND void_reason IS NOT NULL
      AND voided_by IS NOT NULL
      AND voided_at IS NOT NULL)
    OR
    (status <> 'voided'
      AND void_idempotency_key IS NULL
      AND void_reason IS NULL
      AND voided_by IS NULL
      AND voided_at IS NULL)
  ),
  ADD CONSTRAINT pos_sales_void_idempotency_key_check CHECK (
    void_idempotency_key IS NULL
    OR length(void_idempotency_key) BETWEEN 8 AND 120
  ),
  ADD CONSTRAINT pos_sales_void_reason_check CHECK (
    void_reason IS NULL OR length(trim(void_reason)) BETWEEN 5 AND 500
  ),
  ADD CONSTRAINT pos_sales_resume_idempotency_key_check CHECK (
    resume_idempotency_key IS NULL
    OR length(resume_idempotency_key) BETWEEN 8 AND 120
  );
CREATE UNIQUE INDEX pos_sales_void_idempotency_key_unique
  ON pos_sales (void_idempotency_key)
  WHERE void_idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX pos_sales_resume_idempotency_key_unique
  ON pos_sales (resume_idempotency_key)
  WHERE resume_idempotency_key IS NOT NULL;

ALTER TABLE document_number_sequences
  DROP CONSTRAINT document_number_sequences_document_type_check,
  ADD CONSTRAINT document_number_sequences_document_type_check CHECK (
    document_type IN (
      'invoice', 'purchase_request', 'purchase_order', 'inventory_transfer',
      'goods_receipt', 'supplier_return', 'receipt', 'refund'
    )
  );
INSERT INTO document_number_sequences (document_type, prefix, next_number)
VALUES ('refund', 'RFD', 1)
ON CONFLICT DO NOTHING;

ALTER TABLE pos_refund_lines
  DROP CONSTRAINT pos_refund_lines_amount_cents_check,
  ADD CONSTRAINT pos_refund_lines_amount_cents_check CHECK (amount_cents >= 0);

ALTER TABLE pos_refund_payments
  ADD COLUMN reference text CHECK (reference IS NULL OR length(reference) <= 120);
