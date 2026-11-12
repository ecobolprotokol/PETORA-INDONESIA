ALTER TABLE pos_refund_payments
  ADD COLUMN IF NOT EXISTS reference text
    CHECK (reference IS NULL OR length(reference) <= 120);
