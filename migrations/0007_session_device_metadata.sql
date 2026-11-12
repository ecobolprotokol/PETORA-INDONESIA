ALTER TABLE auth_sessions
  ADD COLUMN user_agent text NOT NULL DEFAULT 'Peramban web'
  CHECK (length(user_agent) <= 512);
