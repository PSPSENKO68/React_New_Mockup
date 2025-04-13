-- Comprehensive migration to add all necessary columns to the orders table
DO $$ 
BEGIN
  -- Add full_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'full_name'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN full_name TEXT;
  END IF;

  -- Add shipping_address column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'shipping_address'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN shipping_address TEXT;
  END IF;

  -- Add email column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'email'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN email TEXT;
  END IF;

  -- Add phone_number column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'phone_number'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN phone_number TEXT;
  END IF;

  -- Add payment_method column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'payment_method'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_method TEXT;
  END IF;

  -- Add payment_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'payment_status'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_status TEXT;
  END IF;

  -- Add shipping_fee column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'shipping_fee'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN shipping_fee NUMERIC(10, 2);
  END IF;

  -- Add subtotal column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'subtotal'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN subtotal NUMERIC(10, 2);
  END IF;

  -- Add total column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'total'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN total NUMERIC(10, 2);
  END IF;

  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'status'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN status TEXT;
  END IF;

  -- Add notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'notes'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN notes TEXT;
  END IF;

  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'user_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN user_id TEXT;
  END IF;
END $$; 