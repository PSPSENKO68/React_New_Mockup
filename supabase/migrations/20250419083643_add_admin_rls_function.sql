-- Create a stored procedure to add the RLS policy for admin users
CREATE OR REPLACE FUNCTION public.add_admin_rls_policy()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- This means the function runs with the permissions of the creator
SET search_path = public
AS $$
BEGIN
  -- Check if the policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'admin_users' 
    AND policyname = 'Allow authenticated users to insert admin users'
  ) THEN
    -- Create the RLS policy
    EXECUTE format('
      CREATE POLICY "Allow authenticated users to insert admin users"
      ON admin_users
      FOR INSERT
      TO authenticated
      WITH CHECK (true)
    ');
    
    RETURN true;
  ELSE
    RETURN true; -- Policy already exists
  END IF;
END;
$$; 