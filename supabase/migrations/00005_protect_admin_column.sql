
-- Prevent non-service-role users from modifying the is_admin column.
-- Only SECURITY DEFINER functions (like handle_new_user) or direct
-- service_role access should be able to change admin status.

CREATE OR REPLACE FUNCTION protect_admin_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow the INSERT (handle_new_user trigger creates profiles with is_admin = false)
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, block any attempt to change is_admin from a regular session
  IF TG_OP = 'UPDATE' AND NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    -- Only allow if the current session is using the service_role key
    -- (i.e. no JWT / auth.uid() is null, which happens with service_role)
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot modify is_admin column directly. Use the admin management endpoint.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop the existing updated_at trigger so we can insert our protection trigger first
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;

-- Protection trigger fires BEFORE any update (prevents the change)
CREATE TRIGGER protect_profiles_admin_column
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_admin_column();

-- Re-create the updated_at trigger (fires AFTER protection trigger)
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- SECURITY DEFINER function for admins to toggle admin status on other users.
-- Runs as the function owner (postgres), bypassing the RLS trigger.
CREATE OR REPLACE FUNCTION toggle_user_admin(target_user_id uuid, new_admin_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the calling user is an admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can change admin status';
  END IF;

  UPDATE profiles SET is_admin = new_admin_status WHERE id = target_user_id;
END;
$$;
