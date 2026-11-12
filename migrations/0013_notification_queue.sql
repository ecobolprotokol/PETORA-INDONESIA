ALTER TABLE business_settings
  ADD COLUMN quiet_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN quiet_hours_start text NOT NULL DEFAULT '22:00',
  ADD COLUMN quiet_hours_end text NOT NULL DEFAULT '08:00',
  ADD CONSTRAINT business_settings_quiet_hours_start_format
    CHECK (quiet_hours_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT business_settings_quiet_hours_end_format
    CHECK (quiet_hours_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

CREATE TABLE notification_templates (
  key text PRIMARY KEY,
  description text NOT NULL,
  title_template text NOT NULL,
  body_template text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  honors_quiet_hours boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  template_key text NOT NULL REFERENCES notification_templates(key) ON DELETE RESTRICT,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz
);

CREATE INDEX staff_notifications_inbox_idx
  ON staff_notifications (recipient_user_id, status, created_at DESC);

INSERT INTO notification_templates
  (key, description, title_template, body_template, honors_quiet_hours)
VALUES
  ('staff.created', 'Pemberitahuan pembuatan akun staf', 'Akun staf dibuat',
   'Halo {{name}}, akun Petora Anda sudah dibuat.', true),
  ('access.role_assigned', 'Pemberitahuan penugasan peran', 'Peran diperbarui',
   'Peran {{roleName}} telah ditugaskan ke akun Anda.', true);
