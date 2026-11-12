CREATE FUNCTION protect_owner_staff_user() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_owner THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Akun Owner tidak dapat dihapus.'
        USING ERRCODE = '23514', CONSTRAINT = 'staff_users_owner_protected';
    END IF;

    IF NOT NEW.is_owner OR NOT NEW.is_active THEN
      RAISE EXCEPTION 'Akun Owner tidak dapat diturunkan peran atau dinonaktifkan.'
        USING ERRCODE = '23514', CONSTRAINT = 'staff_users_owner_protected';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER staff_users_protect_owner
  BEFORE UPDATE OF is_owner, is_active OR DELETE ON staff_users
  FOR EACH ROW
  WHEN (OLD.is_owner)
  EXECUTE FUNCTION protect_owner_staff_user();
