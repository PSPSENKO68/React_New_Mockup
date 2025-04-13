-- Remove any dependency on the created_by column
DO $$
BEGIN
  -- Check if there are any triggers that might be referencing created_by
  DROP TRIGGER IF EXISTS order_history_created_by_trigger ON public.order_history;
  
  -- Drop and recreate policies without created_by dependencies
  DROP POLICY IF EXISTS "Anonymous users can insert order history" ON "public"."order_history";
  DROP POLICY IF EXISTS "Users can insert order history" ON "public"."order_history";
  DROP POLICY IF EXISTS "Admins can insert order history" ON "public"."order_history";
  
  -- Create a simple, permissive policy for order_history
  CREATE POLICY "Allow order history insert" ON "public"."order_history"
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
  
  CREATE POLICY "Allow order history select" ON "public"."order_history"
  FOR SELECT TO anon, authenticated
  USING (true);
END $$; 