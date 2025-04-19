/*
  Add RLS policy to allow insertion into admin_users table
  
  If you're having issues with Row-Level Security errors when creating admin users,
  you can execute this SQL directly in the Supabase SQL Editor:
  
  ```sql
  CREATE POLICY "Allow authenticated users to insert admin users"
    ON admin_users
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
  ```
*/

-- First, add a policy that allows any authenticated user to insert into admin_users table
-- This is a temporary solution to enable admin creation
CREATE POLICY "Allow authenticated users to insert admin users"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (true); 