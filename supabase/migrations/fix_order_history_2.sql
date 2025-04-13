-- Update RLS policy for anonymous orders history
DO $$
BEGIN
  -- Drop existing policy if it exists
  DROP POLICY IF EXISTS "Anonymous users can insert order history" ON "public"."order_history";
  
  -- Create new policy for anonymous order history
  CREATE POLICY "Anonymous users can insert order history" ON "public"."order_history"
  FOR INSERT TO anon
  WITH CHECK (true);
  
  -- Create policy for reading anonymous order history
  DROP POLICY IF EXISTS "Anonymous users can view order history by anonymous_id" ON "public"."order_history";
  
  CREATE POLICY "Anonymous users can view order history by anonymous_id" ON "public"."order_history"
  FOR SELECT TO anon
  USING (
    anonymous_id IS NOT NULL OR 
    order_id IN (SELECT id FROM public.orders WHERE anonymous_id IS NOT NULL)
  );
END $$; 