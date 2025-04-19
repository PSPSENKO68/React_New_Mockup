/*
  Update admin_users table to support Staff role and permissions
  
  Changes:
  1. Update role field to support 'admin' and 'staff'
  2. Add permissions for staff members
  3. Add is_active field for account activation/deactivation
*/

-- Update role CHECK constraint to allow staff role
ALTER TABLE admin_users 
DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users 
ADD CONSTRAINT admin_users_role_check 
CHECK (role IN ('admin', 'staff'));

-- Add permissions array (orders, inventory, phone_models, case_types)
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- Add is_active field (default to true)
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing admins to have all permissions by default
UPDATE admin_users 
SET permissions = '["orders", "inventory", "phone_models", "case_types"]'::jsonb 
WHERE role = 'admin' AND (permissions IS NULL OR permissions = '[]'::jsonb);

-- Create a function to check staff permissions
CREATE OR REPLACE FUNCTION has_staff_permission(user_id UUID, required_permission TEXT) 
RETURNS BOOLEAN AS $$
DECLARE
  user_permissions JSONB;
  user_role TEXT;
  user_active BOOLEAN;
BEGIN
  -- Get user permissions, role and active status
  SELECT permissions, role, is_active INTO user_permissions, user_role, user_active
  FROM admin_users
  WHERE id = user_id;
  
  -- Admin role has all permissions
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Inactive accounts have no permissions
  IF NOT user_active THEN
    RETURN FALSE;
  END IF;
  
  -- Check if staff has the specific permission
  RETURN user_permissions ? required_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 