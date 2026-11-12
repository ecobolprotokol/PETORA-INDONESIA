ALTER TABLE customers
ADD COLUMN phone_normalized text,
ADD COLUMN address text,
ADD COLUMN tags text[] NOT NULL DEFAULT ARRAY[]::text[],
ADD COLUMN marketing_consent boolean NOT NULL DEFAULT false,
ADD COLUMN notification_preferences jsonb NOT NULL DEFAULT '{"appointments": true, "marketing": false}'::jsonb;

UPDATE customers
SET phone_normalized = CASE
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') LIKE '0%'
    THEN '62' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
  ELSE regexp_replace(phone, '[^0-9]', '', 'g')
END;

ALTER TABLE customers
ALTER COLUMN phone_normalized SET NOT NULL;

CREATE INDEX customers_phone_normalized_idx ON customers (phone_normalized);
CREATE INDEX customers_email_normalized_idx ON customers (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  species text NOT NULL CHECK (species IN ('dog', 'cat', 'bird', 'small_mammal', 'reptile', 'other')),
  breed text CHECK (breed IS NULL OR length(breed) <= 120),
  sex text NOT NULL DEFAULT 'unknown' CHECK (sex IN ('male', 'female', 'unknown')),
  birth_date date,
  estimated_age_months integer CHECK (estimated_age_months IS NULL OR estimated_age_months BETWEEN 0 AND 2400),
  color text CHECK (color IS NULL OR length(color) <= 120),
  microchip_number text,
  photo_url text CHECK (photo_url IS NULL OR length(photo_url) <= 2048),
  is_sterilized boolean NOT NULL DEFAULT false,
  allergies text[] NOT NULL DEFAULT ARRAY[]::text[],
  behavior_notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deceased', 'transferred')),
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pets_name_search_idx ON pets (lower(name));
CREATE UNIQUE INDEX pets_microchip_lower_unique ON pets (lower(microchip_number))
WHERE microchip_number IS NOT NULL;

CREATE TABLE pet_owners (
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  relationship text NOT NULL DEFAULT 'owner' CHECK (length(trim(relationship)) BETWEEN 1 AND 60),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pet_id, customer_id)
);

CREATE INDEX pet_owners_customer_idx ON pet_owners (customer_id, pet_id);
CREATE UNIQUE INDEX pet_owners_single_primary_idx ON pet_owners (pet_id) WHERE is_primary;

CREATE TABLE pet_weight_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  weight_kg numeric(8, 3) NOT NULL CHECK (weight_kg > 0 AND weight_kg <= 1000),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  note text,
  recorded_by uuid REFERENCES staff_users(id) ON DELETE SET NULL
);

CREATE INDEX pet_weight_history_pet_date_idx ON pet_weight_history (pet_id, recorded_at DESC);

CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  parent_id uuid REFERENCES product_categories(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_categories_name_lower_unique ON product_categories (lower(name));

CREATE TABLE units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  abbreviation text NOT NULL CHECK (length(trim(abbreviation)) BETWEEN 1 AND 20),
  dimension text NOT NULL CHECK (dimension IN ('count', 'mass', 'volume', 'length')),
  base_unit_id uuid REFERENCES units(id) ON DELETE RESTRICT,
  to_base_factor numeric(14, 6) NOT NULL DEFAULT 1 CHECK (to_base_factor > 0),
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX units_abbreviation_lower_unique ON units (lower(abbreviation));

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  sku text NOT NULL CHECK (length(trim(sku)) BETWEEN 1 AND 80),
  product_type text NOT NULL CHECK (product_type IN ('general', 'medicine', 'feed', 'accessory')),
  category_id uuid REFERENCES product_categories(id) ON DELETE RESTRICT,
  brand text CHECK (brand IS NULL OR length(brand) <= 120),
  photo_url text CHECK (photo_url IS NULL OR length(photo_url) <= 2048),
  description text,
  base_unit_id uuid REFERENCES units(id) ON DELETE RESTRICT,
  medicine_class text CHECK (medicine_class IS NULL OR length(medicine_class) <= 120),
  prescription_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_medicine_fields_check
    CHECK (product_type = 'medicine' OR (medicine_class IS NULL AND NOT prescription_required))
);

CREATE UNIQUE INDEX products_sku_lower_unique ON products (lower(sku));
CREATE INDEX products_name_search_idx ON products (lower(name));
CREATE INDEX products_category_idx ON products (category_id, lower(name));

CREATE TABLE product_unit_conversions (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  conversion_factor numeric(14, 6) NOT NULL CHECK (conversion_factor > 0),
  PRIMARY KEY (product_id, unit_id)
);

CREATE TABLE product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  sku text NOT NULL CHECK (length(trim(sku)) BETWEEN 1 AND 80),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_variants_sku_lower_unique ON product_variants (lower(sku));
CREATE UNIQUE INDEX product_variants_product_name_lower_unique
ON product_variants (product_id, lower(name));

CREATE TABLE product_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  barcode text NOT NULL CHECK (length(trim(barcode)) BETWEEN 4 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_barcodes_lower_unique ON product_barcodes (lower(barcode));
CREATE INDEX product_barcodes_product_idx ON product_barcodes (product_id);

CREATE TABLE price_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX price_tiers_name_lower_unique ON price_tiers (lower(name));

CREATE TABLE product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  price_tier_id uuid REFERENCES price_tiers(id) ON DELETE RESTRICT,
  purchase_price_cents bigint CHECK (purchase_price_cents IS NULL OR purchase_price_cents >= 0),
  selling_price_cents bigint NOT NULL CHECK (selling_price_cents >= 0),
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_prices_scope_unique
    UNIQUE NULLS NOT DISTINCT (product_id, variant_id, branch_id, price_tier_id)
);

CREATE INDEX product_prices_branch_tier_idx ON product_prices (branch_id, price_tier_id);

CREATE TABLE service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX service_categories_name_lower_unique ON service_categories (lower(name));

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  code text NOT NULL CHECK (length(trim(code)) BETWEEN 1 AND 80),
  category_id uuid REFERENCES service_categories(id) ON DELETE RESTRICT,
  description text,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX services_code_lower_unique ON services (lower(code));
CREATE INDEX services_name_search_idx ON services (lower(name));

CREATE TABLE service_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  price_tier_id uuid REFERENCES price_tiers(id) ON DELETE RESTRICT,
  price_cents bigint NOT NULL CHECK (price_cents >= 0),
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_prices_scope_unique
    UNIQUE NULLS NOT DISTINCT (service_id, branch_id, price_tier_id)
);

CREATE INDEX service_prices_branch_tier_idx ON service_prices (branch_id, price_tier_id);

INSERT INTO price_tiers (name, description)
VALUES ('Umum', 'Harga standar')
ON CONFLICT DO NOTHING;

INSERT INTO access_permissions (key, description, branch_scoped, supports_own_scope, high_risk)
VALUES
  ('pets.read', 'Melihat data hewan dan pemiliknya', false, true, true),
  ('pets.manage', 'Membuat dan mengubah data hewan', false, true, true),
  ('products.read', 'Melihat katalog produk dan harga jual', false, true, false),
  ('products.manage', 'Mengelola katalog produk, satuan, dan harga', false, true, true),
  ('products.cost.read', 'Melihat harga beli produk', false, true, true),
  ('services.read', 'Melihat katalog layanan dan harga', false, true, false),
  ('services.manage', 'Mengelola katalog layanan dan harga', false, true, true)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  branch_scoped = EXCLUDED.branch_scoped,
  supports_own_scope = EXCLUDED.supports_own_scope,
  high_risk = EXCLUDED.high_risk;
