CREATE TABLE business_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  default_timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  locale text NOT NULL DEFAULT 'id-ID' CHECK (locale IN ('id-ID', 'en-US')),
  tax_enabled boolean NOT NULL DEFAULT false,
  tax_rate_bps integer NOT NULL DEFAULT 0 CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  tax_included boolean NOT NULL DEFAULT false,
  primary_color text NOT NULL DEFAULT '#1E765D'
    CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO business_settings (id) VALUES (1);

CREATE TABLE system_module_features (
  feature_key text PRIMARY KEY
    CHECK (feature_key IN ('commissions', 'loyalty', 'inpatient')),
  is_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO system_module_features (feature_key, is_enabled)
VALUES ('commissions', false), ('loyalty', false), ('inpatient', false);

CREATE TABLE document_number_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL
    CHECK (document_type IN ('invoice', 'purchase_order', 'receipt')),
  branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT,
  prefix text NOT NULL CHECK (prefix ~ '^[A-Z0-9][A-Z0-9/_-]{0,15}$'),
  next_number bigint NOT NULL CHECK (next_number BETWEEN 1 AND 999999999999),
  minimum_width smallint NOT NULL DEFAULT 5 CHECK (minimum_width BETWEEN 1 AND 12),
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX document_number_sequences_global_unique
  ON document_number_sequences (document_type)
  WHERE branch_id IS NULL;
CREATE UNIQUE INDEX document_number_sequences_branch_unique
  ON document_number_sequences (document_type, branch_id)
  WHERE branch_id IS NOT NULL;

INSERT INTO document_number_sequences (document_type, prefix, next_number)
VALUES ('invoice', 'INV', 1), ('purchase_order', 'PO', 1), ('receipt', 'RCP', 1);
