ALTER TABLE staff_users
  ADD COLUMN IF NOT EXISTS supervisor_pin_hash text;