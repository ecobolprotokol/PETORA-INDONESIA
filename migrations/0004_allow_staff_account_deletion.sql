CREATE OR REPLACE FUNCTION protect_owner_staff_user() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_owner THEN
      RAISE EXCEPTION 'Akun Owner tidak dapat dihapus.'
        USING ERRCODE = '23514', CONSTRAINT = 'staff_users_owner_protected';
    END IF;

    RETURN OLD;
  END IF;

  IF OLD.is_owner AND (NOT NEW.is_owner OR NOT NEW.is_active) THEN
    RAISE EXCEPTION 'Akun Owner tidak dapat diturunkan peran atau dinonaktifkan.'
      USING ERRCODE = '23514', CONSTRAINT = 'staff_users_owner_protected';
  END IF;

  RETURN NEW;
END;
$$;
