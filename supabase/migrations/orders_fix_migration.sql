-- Modify the orders table to handle anonymous users
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

-- Add anonymous_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'anonymous_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN anonymous_id TEXT;
  END IF;
END $$;

-- Modify user_id to be nullable
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policy for anonymous orders
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Anonymous users can insert orders" ON "public"."orders";
  
  -- Create new policy for anonymous orders
  CREATE POLICY "Anonymous users can insert orders" ON "public"."orders"
  FOR INSERT TO anon
  WITH CHECK (true);
  
  -- Create policy for reading anonymous orders
  DROP POLICY IF EXISTS "Anonymous users can view orders by anonymous_id" ON "public"."orders";
  
  CREATE POLICY "Anonymous users can view orders by anonymous_id" ON "public"."orders"
  FOR SELECT TO anon
  USING (anonymous_id IS NOT NULL);
END $$; 