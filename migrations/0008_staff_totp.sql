ALTER TABLE staff_users
  ADD COLUMN totp_secret_ciphertext text,
  ADD COLUMN totp_pending_secret_ciphertext text,
  ADD COLUMN totp_pending_expires_at timestamptz,
  ADD COLUMN totp_enabled_at timestamptz,
  ADD COLUMN totp_last_used_step bigint NOT NULL DEFAULT -1;

ALTER TABLE access_roles
  ADD COLUMN requires_two_factor boolean NOT NULL DEFAULT false;

CREATE TABLE auth_login_challenges (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_login_challenges_expiry_idx ON auth_login_challenges (expires_at);

CREATE TABLE auth_totp_recovery_codes (
  user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code_hash)
);
