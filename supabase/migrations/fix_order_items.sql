-- Update RLS policy for order_items to allow anonymous users
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Anonymous users can insert order items" ON "public"."order_items";
  
  -- Create new policy for anonymous order items
  CREATE POLICY "Anonymous users can insert order items" ON "public"."order_items"
  FOR INSERT TO anon
  WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE anonymous_id IS NOT NULL)
  );
  
  -- Create policy for reading anonymous order items
  DROP POLICY IF EXISTS "Anonymous users can view order items by order_id" ON "public"."order_items";
  
  CREATE POLICY "Anonymous users can view order items by order_id" ON "public"."order_items"
  FOR SELECT TO anon
  USING (
    order_id IN (SELECT id FROM public.orders WHERE anonymous_id IS NOT NULL)
  );
END $$; 