
-- Drop the INSERT RLS policy on profiles that blocks the trigger
-- (auth.uid() is NULL when the trigger fires, so the WITH CHECK fails)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

-- Re-create the trigger function with explicit SET search_path to ensure
-- it runs cleanly as the postgres role (SECURITY DEFINER bypasses RLS
-- only when the function owner is a superuser / has bypassrls)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
