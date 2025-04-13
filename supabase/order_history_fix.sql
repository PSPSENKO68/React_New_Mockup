-- Fix order_history table by adding the created_by column if it doesn't exist
DO $$ 
BEGIN
  -- Add created_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'order_history' 
    AND column_name = 'created_by'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.order_history ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
END $$; 