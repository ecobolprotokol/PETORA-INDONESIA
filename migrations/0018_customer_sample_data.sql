ALTER TABLE customers
ADD COLUMN is_sample boolean NOT NULL DEFAULT false;

CREATE INDEX customers_sample_idx ON customers (id) WHERE is_sample;
