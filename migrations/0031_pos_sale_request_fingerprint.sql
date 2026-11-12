ALTER TABLE pos_sales
  ADD COLUMN request_fingerprint text,
  ADD COLUMN price_tier_id uuid REFERENCES price_tiers(id) ON DELETE RESTRICT;

UPDATE pos_sales
SET request_fingerprint = 'legacy:' || id::text
WHERE request_fingerprint IS NULL;

ALTER TABLE pos_sales
  ALTER COLUMN request_fingerprint SET NOT NULL,
  ADD CONSTRAINT pos_sales_request_fingerprint_check
    CHECK (length(request_fingerprint) BETWEEN 8 AND 128);
