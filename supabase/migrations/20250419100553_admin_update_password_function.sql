-- Function to allow admins to update user passwords
CREATE OR REPLACE FUNCTION admin_update_user_password(user_id UUID, new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function creator's privileges
SET search_path = public
AS $$
DECLARE
  requesting_user_id UUID;
  requesting_user_role TEXT;
  target_user_role TEXT;
BEGIN
  -- Get the ID of the user making the request
  requesting_user_id := auth.uid();
  
  -- Check if the requesting user exists in admin_users
  SELECT role INTO requesting_user_role
  FROM admin_users
  WHERE id = requesting_user_id;
  
  IF requesting_user_role IS NULL THEN
    RAISE EXCEPTION 'Not authorized to update passwords';
  END IF;
  
  -- Get role of target user
  SELECT role INTO target_user_role
  FROM admin_users
  WHERE id = user_id;
  
  -- Staff cannot change passwords of admin users
  IF requesting_user_role = 'staff' AND target_user_role = 'admin' THEN
    RAISE EXCEPTION 'Staff cannot change passwords of admin users';
  END IF;
  
  -- NOTE: We can't directly update auth.users password from here
  -- Instead, we'll return true and let the frontend use the Auth API to update the password
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Function to delete admin users
CREATE OR REPLACE FUNCTION delete_admin_user(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Run with function creator's privileges
SET search_path = public
AS $$
DECLARE
  requesting_user_id UUID;
  requesting_user_role TEXT;
  target_user_role TEXT;
BEGIN
  -- Get the ID of the user making the request
  requesting_user_id := auth.uid();
  
  -- Check if the requesting user exists in admin_users and is an admin
  SELECT role INTO requesting_user_role
  FROM admin_users
  WHERE id = requesting_user_id;
  
  IF requesting_user_role IS NULL OR requesting_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  
  -- Get role of target user
  SELECT role INTO target_user_role
  FROM admin_users
  WHERE id = user_id;
  
  -- Check if trying to delete yourself
  IF requesting_user_id = user_id THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;
  
  -- Delete from admin_users first (this will work due to RLS bypass)
  DELETE FROM admin_users WHERE id = user_id;
  
  -- Important: We're not actually deleting from auth.users as this requires superuser
  -- privileges that we don't have. In a real production app, you'd need a server-side
  -- function with proper admin credentials to delete the auth user.
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$; 