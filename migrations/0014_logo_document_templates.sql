ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS invoice_template text,
  ADD COLUMN IF NOT EXISTS receipt_template text,
  ADD COLUMN IF NOT EXISTS certificate_template text;