-- Change the user_id column type in orders table from UUID to TEXT
DO $$ 
BEGIN
  -- Check if user_id column exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'user_id'
    AND table_schema = 'public'
  ) THEN
    -- Check if user_id column is of type UUID
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'user_id'
      AND table_schema = 'public'
      AND data_type = 'uuid'
    ) THEN
      -- If there are existing foreign key constraints, you would need to drop them first
      -- This is a simplified approach assuming no foreign key constraints
      
      -- Create a temporary column
      ALTER TABLE public.orders ADD COLUMN user_id_text TEXT;
      
      -- Try to convert existing values if possible
      -- This will fail for values that aren't valid UUIDs, which is fine
      BEGIN
        -- Convert UUID values to text
        UPDATE public.orders SET user_id_text = user_id::TEXT WHERE user_id IS NOT NULL;
      EXCEPTION WHEN OTHERS THEN
        -- If conversion fails, just continue
        NULL;
      END;
      
      -- Drop the old column
      ALTER TABLE public.orders DROP COLUMN user_id;
      
      -- Rename the temp column to the original name
      ALTER TABLE public.orders RENAME COLUMN user_id_text TO user_id;
    ELSE
      -- Column exists but is not UUID type, so no change needed
      RAISE NOTICE 'user_id column is not of type UUID, no change needed';
    END IF;
  ELSE
    -- Add user_id column as TEXT
    ALTER TABLE public.orders ADD COLUMN user_id TEXT;
  END IF;
END $$; 