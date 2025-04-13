-- Modify the order_history table to handle anonymous users

-- Add anonymous_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'order_history' 
    AND column_name = 'anonymous_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.order_history ADD COLUMN anonymous_id TEXT;
  END IF;
END $$;

-- Make created_by column nullable since anonymous users don't have a UUID
ALTER TABLE public.order_history ALTER COLUMN created_by DROP NOT NULL;

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