-- Comprehensive fix for the order system to work with anonymous users

-- Enable RLS on all order-related tables if not already enabled
ALTER TABLE IF EXISTS "public"."orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."order_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."ghn_shipping" ENABLE ROW LEVEL SECURITY;

-- Fix RLS policies for anonymous users on orders table
DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Anonymous users can insert orders" ON "public"."orders";
  DROP POLICY IF EXISTS "Anonymous users can view own orders" ON "public"."orders";
  DROP POLICY IF EXISTS "Anonymous users can view orders by anonymous_id" ON "public"."orders";
  
  -- Create policies for anonymous users
  CREATE POLICY "Anonymous users can insert orders" ON "public"."orders"
  FOR INSERT TO anon
  WITH CHECK (true);
  
  CREATE POLICY "Anonymous users can view orders by anonymous_id" ON "public"."orders"
  FOR SELECT TO anon
  USING (anonymous_id IS NOT NULL);
END $$;

-- Fix RLS policies for anonymous users on order_items table
DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Anonymous users can insert order items" ON "public"."order_items";
  DROP POLICY IF EXISTS "Anonymous users can view order items" ON "public"."order_items";
  
  -- Create policies for anonymous users
  CREATE POLICY "Anonymous users can insert order items" ON "public"."order_items"
  FOR INSERT TO anon
  WITH CHECK (true);
  
  CREATE POLICY "Anonymous users can view order items" ON "public"."order_items"
  FOR SELECT TO anon
  USING (true);
END $$;

-- Fix RLS policies for anonymous users on order_history table
DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Anonymous users can insert order history" ON "public"."order_history";
  DROP POLICY IF EXISTS "Anonymous users can view order history" ON "public"."order_history";
  
  -- Create policies for anonymous users
  CREATE POLICY "Anonymous users can insert order history" ON "public"."order_history"
  FOR INSERT TO anon
  WITH CHECK (true);
  
  CREATE POLICY "Anonymous users can view order history" ON "public"."order_history"
  FOR SELECT TO anon
  USING (true);
END $$;

-- Fix RLS policies for anonymous users on ghn_shipping table
DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Anonymous users can insert shipping" ON "public"."ghn_shipping";
  DROP POLICY IF EXISTS "Anonymous users can view shipping" ON "public"."ghn_shipping";
  
  -- Create policies for anonymous users
  CREATE POLICY "Anonymous users can insert shipping" ON "public"."ghn_shipping"
  FOR INSERT TO anon
  WITH CHECK (true);
  
  CREATE POLICY "Anonymous users can view shipping" ON "public"."ghn_shipping"
  FOR SELECT TO anon
  USING (true);
END $$; 