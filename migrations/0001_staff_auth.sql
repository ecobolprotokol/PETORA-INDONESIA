CREATE TABLE system_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  business_name text,
  setup_completed_at timestamptz
);

INSERT INTO system_state (id) VALUES (1);

CREATE TABLE staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  email text NOT NULL,
  password_hash text NOT NULL,
  is_owner boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX staff_users_email_lower_unique ON staff_users (lower(email));
CREATE UNIQUE INDEX staff_users_single_owner_unique ON staff_users (is_owner) WHERE is_owner;

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX auth_sessions_user_active_idx
  ON auth_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_created_at_idx ON audit_events (created_at);
CREATE INDEX audit_events_actor_action_idx ON audit_events (actor_user_id, action);

CREATE TABLE auth_login_attempts (
  email_hash char(64) PRIMARY KEY,
  attempt_count integer NOT NULL CHECK (attempt_count > 0),
  window_started_at timestamptz NOT NULL
);

CREATE INDEX auth_login_attempts_window_idx ON auth_login_attempts (window_started_at);
