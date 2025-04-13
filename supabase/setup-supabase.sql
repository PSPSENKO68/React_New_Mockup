-- Rename tables if they have old names (optional compatibility step)
DO $$
BEGIN
    -- Check if 'inventory' table exists (old name) but 'inventory_items' doesn't
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'inventory' AND table_schema = 'public'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'inventory_items' AND table_schema = 'public'
    ) THEN
        -- Rename inventory to inventory_items
        ALTER TABLE "public"."inventory" RENAME TO "inventory_items";
    END IF;
END $$;

-- Enable RLS (Row Level Security)
alter table if exists "public"."phone_models" enable row level security;
alter table if exists "public"."case_types" enable row level security;
alter table if exists "public"."inventory_items" enable row level security;

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
    -- Check if price column exists in case_types
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_types' AND column_name = 'price'
    ) THEN
        ALTER TABLE "public"."case_types" ADD COLUMN "price" numeric(10,2) NOT NULL DEFAULT 29.99;
        
        -- Update existing records with default prices based on case type name
        UPDATE "public"."case_types" SET "price" = 29.99 WHERE "name" LIKE '%Clear%';
        UPDATE "public"."case_types" SET "price" = 49.99 WHERE "name" LIKE '%Leather%';
        UPDATE "public"."case_types" SET "price" = 39.99 WHERE "name" LIKE '%Silicone%' OR "name" LIKE '%Silicon%';
        UPDATE "public"."case_types" SET "price" = 59.99 WHERE "name" LIKE '%MagSafe%';
        UPDATE "public"."case_types" SET "price" = 29.99 WHERE "price" IS NULL;
    END IF;
    
    -- Check if image_url column exists in case_types
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_types' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE "public"."case_types" ADD COLUMN "image_url" text;
    END IF;
END $$;

-- Check table structure to see if we need to create tables
-- or if we need to adapt to existing structure
DO $$
DECLARE
    phone_id_type text;
    case_id_type text;
BEGIN
    -- Check column types of existing tables
    SELECT data_type INTO phone_id_type
    FROM information_schema.columns
    WHERE table_name = 'phone_models' AND column_name = 'id'
    LIMIT 1;
    
    SELECT data_type INTO case_id_type
    FROM information_schema.columns
    WHERE table_name = 'case_types' AND column_name = 'id'
    LIMIT 1;
    
    -- If tables don't exist yet, create them
    IF phone_id_type IS NULL THEN
        -- Phone Models Table with UUID
        CREATE TABLE IF NOT EXISTS "public"."phone_models" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "name" text NOT NULL UNIQUE,
            "active" boolean DEFAULT true,
            "created_at" timestamp with time zone DEFAULT now()
        );
    END IF;
    
    IF case_id_type IS NULL THEN
        -- Case Types Table with UUID
        CREATE TABLE IF NOT EXISTS "public"."case_types" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "name" text NOT NULL UNIQUE,
            "description" text,
            "price" numeric(10,2) NOT NULL DEFAULT 29.99,
            "image_url" text,
            "created_at" timestamp with time zone DEFAULT now()
        );
    END IF;
    
    -- Inventory Items Table with UUIDs for foreign keys if needed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'inventory_items' AND table_schema = 'public'
    ) THEN
        CREATE TABLE "public"."inventory_items" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "phone_model_id" uuid REFERENCES "public"."phone_models"("id"),
            "case_type_id" uuid REFERENCES "public"."case_types"("id"),
            "quantity" integer DEFAULT 0,
            "reorder_point" integer DEFAULT 10,
            "price" numeric(10,2),
            "created_at" timestamp with time zone DEFAULT now(),
            UNIQUE("phone_model_id", "case_type_id")
        );
    END IF;
END $$;

-- Create RLS Policies safely - checking if they exist first
DO $$
BEGIN
    -- Phone models read access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'phone_models' AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" ON "public"."phone_models"
        FOR SELECT USING (true);
    END IF;
    
    -- Case types read access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'case_types' AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" ON "public"."case_types"
        FOR SELECT USING (true);
    END IF;
    
    -- Inventory items read access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'inventory_items' AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" ON "public"."inventory_items"
        FOR SELECT USING (true);
    END IF;
    
    -- Phone models admin access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'phone_models' AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" ON "public"."phone_models"
        FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    
    -- Case types admin access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'case_types' AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" ON "public"."case_types"
        FOR ALL USING (auth.role() = 'authenticated');
    END IF;
    
    -- Inventory items admin access
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'inventory_items' AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" ON "public"."inventory_items"
        FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Sample data for testing - we need to handle UUID columns
DO $$
DECLARE
    iphone15_id uuid;
    iphone14_id uuid;
    samsung_id uuid;
    pixel_id uuid;
    clear_id uuid;
    leather_id uuid;
    silicone_id uuid;
    magsafe_id uuid;
BEGIN
    -- Get existing phone model IDs or insert new ones
    SELECT id INTO iphone15_id FROM "public"."phone_models" WHERE "name" = 'iPhone 15 Pro' LIMIT 1;
    IF iphone15_id IS NULL THEN
        INSERT INTO "public"."phone_models" ("name", "active") 
        VALUES ('iPhone 15 Pro', true)
        RETURNING id INTO iphone15_id;
    END IF;
    
    SELECT id INTO iphone14_id FROM "public"."phone_models" WHERE "name" = 'iPhone 14' LIMIT 1;
    IF iphone14_id IS NULL THEN
        INSERT INTO "public"."phone_models" ("name", "active") 
        VALUES ('iPhone 14', true)
        RETURNING id INTO iphone14_id;
    END IF;
    
    SELECT id INTO samsung_id FROM "public"."phone_models" WHERE "name" = 'Samsung Galaxy S23' LIMIT 1;
    IF samsung_id IS NULL THEN
        INSERT INTO "public"."phone_models" ("name", "active") 
        VALUES ('Samsung Galaxy S23', true)
        RETURNING id INTO samsung_id;
    END IF;
    
    SELECT id INTO pixel_id FROM "public"."phone_models" WHERE "name" = 'Google Pixel 8' LIMIT 1;
    IF pixel_id IS NULL THEN
        INSERT INTO "public"."phone_models" ("name", "active") 
        VALUES ('Google Pixel 8', true)
        RETURNING id INTO pixel_id;
    END IF;
    
    -- Get existing case type IDs or insert new ones
    SELECT id INTO clear_id FROM "public"."case_types" WHERE "name" = 'Clear Case' LIMIT 1;
    IF clear_id IS NULL THEN
        INSERT INTO "public"."case_types" ("name", "description", "price", "image_url") 
        VALUES ('Clear Case', 'Transparent case to show off your phone', 29.99, 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&q=80')
        RETURNING id INTO clear_id;
    END IF;
    
    SELECT id INTO leather_id FROM "public"."case_types" WHERE "name" = 'Leather Case' LIMIT 1;
    IF leather_id IS NULL THEN
        INSERT INTO "public"."case_types" ("name", "description", "price", "image_url") 
        VALUES ('Leather Case', 'Premium leather case for a luxurious feel', 49.99, 'https://images.unsplash.com/photo-1606041011872-596597976b25?auto=format&fit=crop&q=80')
        RETURNING id INTO leather_id;
    END IF;
    
    SELECT id INTO silicone_id FROM "public"."case_types" WHERE "name" = 'Silicone Case' LIMIT 1;
    IF silicone_id IS NULL THEN
        INSERT INTO "public"."case_types" ("name", "description", "price", "image_url") 
        VALUES ('Silicone Case', 'Soft-touch silicone case with microfiber lining', 39.99, 'https://images.unsplash.com/photo-1609695001873-0ff82b8c8389?auto=format&fit=crop&q=80')
        RETURNING id INTO silicone_id;
    END IF;
    
    SELECT id INTO magsafe_id FROM "public"."case_types" WHERE "name" = 'MagSafe Case' LIMIT 1;
    IF magsafe_id IS NULL THEN
        INSERT INTO "public"."case_types" ("name", "description", "price", "image_url") 
        VALUES ('MagSafe Case', 'Compatible with MagSafe accessories', 59.99, 'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&q=80')
        RETURNING id INTO magsafe_id;
    END IF;
    
    -- Add inventory items using the UUID variables
    -- For each combination, attempt to insert or update
    BEGIN
        INSERT INTO "public"."inventory_items" ("phone_model_id", "case_type_id", "quantity", "price")
        VALUES (iphone15_id, clear_id, 25, 29.99)
        ON CONFLICT ("phone_model_id", "case_type_id") DO UPDATE
        SET quantity = 25, price = 29.99;
    EXCEPTION WHEN OTHERS THEN
        -- If composite unique constraint doesn't exist yet, just ignore
        NULL;
    END;
    
    BEGIN
        INSERT INTO "public"."inventory_items" ("phone_model_id", "case_type_id", "quantity", "price")
        VALUES (iphone15_id, leather_id, 15, 49.99)
        ON CONFLICT ("phone_model_id", "case_type_id") DO UPDATE
        SET quantity = 15, price = 49.99;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        INSERT INTO "public"."inventory_items" ("phone_model_id", "case_type_id", "quantity", "price")
        VALUES (iphone15_id, silicone_id, 20, 39.99)
        ON CONFLICT ("phone_model_id", "case_type_id") DO UPDATE
        SET quantity = 20, price = 39.99;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        INSERT INTO "public"."inventory_items" ("phone_model_id", "case_type_id", "quantity", "price")
        VALUES (iphone14_id, clear_id, 30, 29.99)
        ON CONFLICT ("phone_model_id", "case_type_id") DO UPDATE
        SET quantity = 30, price = 29.99;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        INSERT INTO "public"."inventory_items" ("phone_model_id", "case_type_id", "quantity", "price")
        VALUES (iphone14_id, silicone_id, 10, 39.99)
        ON CONFLICT ("phone_model_id", "case_type_id") DO UPDATE
        SET quantity = 10, price = 39.99;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        INSERT INTO "public"."inventory_items" ("phone_model_id", "case_type_id", "quantity", "price")
        VALUES (samsung_id, clear_id, 20, 29.99)
        ON CONFLICT ("phone_model_id", "case_type_id") DO UPDATE
        SET quantity = 20, price = 29.99;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        INSERT INTO "public"."inventory_items" ("phone_model_id", "case_type_id", "quantity", "price")
        VALUES (samsung_id, leather_id, 5, 49.99)
        ON CONFLICT ("phone_model_id", "case_type_id") DO UPDATE
        SET quantity = 5, price = 49.99;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    BEGIN
        INSERT INTO "public"."inventory_items" ("phone_model_id", "case_type_id", "quantity", "price")
        VALUES (pixel_id, magsafe_id, 15, 59.99)
        ON CONFLICT ("phone_model_id", "case_type_id") DO UPDATE
        SET quantity = 15, price = 59.99;
    EXCEPTION WHEN OTHERS THEN NULL; END;
    
    -- Add unique constraint to inventory_items if it doesn't exist yet
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'inventory_items_phone_model_id_case_type_id_key' AND conrelid = 'inventory_items'::regclass
    ) THEN
        BEGIN
            ALTER TABLE "public"."inventory_items" 
            ADD CONSTRAINT "inventory_items_phone_model_id_case_type_id_key" 
            UNIQUE ("phone_model_id", "case_type_id");
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;

-- Add order management tables for GHN shipping and VNPAY payment integration
DO $$
BEGIN
    -- Create shipping_addresses table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'shipping_addresses' AND table_schema = 'public'
    ) THEN
        CREATE TABLE "public"."shipping_addresses" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            "receiver_name" text NOT NULL,
            "phone" text NOT NULL,
            "province_id" int NOT NULL,
            "province_name" text NOT NULL,
            "district_id" int NOT NULL,
            "district_name" text NOT NULL,
            "ward_id" text NOT NULL,
            "ward_name" text NOT NULL,
            "address" text NOT NULL,
            "is_default" boolean DEFAULT false,
            "created_at" timestamp with time zone DEFAULT now(),
            "updated_at" timestamp with time zone DEFAULT now()
        );
        
        -- Create trigger for updated_at
        CREATE TRIGGER update_shipping_addresses_updated_at
            BEFORE UPDATE ON "public"."shipping_addresses"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Create orders table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'orders' AND table_schema = 'public'
    ) THEN
        CREATE TABLE "public"."orders" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "user_id" uuid NOT NULL REFERENCES auth.users(id),
            "status" text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipping', 'delivered', 'cancelled', 'returned')),
            "shipping_address_id" uuid REFERENCES "public"."shipping_addresses"(id),
            "shipping_fee" numeric(10,2) NOT NULL DEFAULT 0,
            "subtotal" numeric(10,2) NOT NULL DEFAULT 0,
            "total" numeric(10,2) NOT NULL DEFAULT 0,
            "note" text,
            "payment_method" text NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'vnpay')),
            "payment_status" text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'cancelled')),
            "created_at" timestamp with time zone DEFAULT now(),
            "updated_at" timestamp with time zone DEFAULT now()
        );
        
        -- Create trigger for updated_at
        CREATE TRIGGER update_orders_updated_at
            BEFORE UPDATE ON "public"."orders"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Create order_items table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'order_items' AND table_schema = 'public'
    ) THEN
        CREATE TABLE "public"."order_items" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "order_id" uuid NOT NULL REFERENCES "public"."orders"(id) ON DELETE CASCADE,
            "inventory_item_id" uuid NOT NULL REFERENCES "public"."inventory_items"(id),
            "quantity" integer NOT NULL,
            "price" numeric(10,2) NOT NULL,
            "created_at" timestamp with time zone DEFAULT now()
        );
    END IF;

    -- Create GHN shipping tracking table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'ghn_shipping' AND table_schema = 'public'
    ) THEN
        CREATE TABLE "public"."ghn_shipping" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "order_id" uuid NOT NULL REFERENCES "public"."orders"(id) ON DELETE CASCADE,
            "ghn_order_code" text,
            "expected_delivery_time" timestamp with time zone,
            "status" text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready_to_pick', 'picking', 'picked', 'delivering', 'delivered', 'delivery_failed', 'returned', 'cancelled')),
            "shipping_fee" numeric(10,2) NOT NULL DEFAULT 0,
            "cod_amount" numeric(10,2) NOT NULL DEFAULT 0,
            "tracking_url" text,
            "note" text,
            "created_at" timestamp with time zone DEFAULT now(),
            "updated_at" timestamp with time zone DEFAULT now(),
            UNIQUE("order_id")
        );
        
        -- Create trigger for updated_at
        CREATE TRIGGER update_ghn_shipping_updated_at
            BEFORE UPDATE ON "public"."ghn_shipping"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Create VNPAY payment tracking table if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'vnpay_payments' AND table_schema = 'public'
    ) THEN
        CREATE TABLE "public"."vnpay_payments" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "order_id" uuid NOT NULL REFERENCES "public"."orders"(id) ON DELETE CASCADE,
            "vnp_txn_ref" text NOT NULL,
            "amount" numeric(10,2) NOT NULL,
            "transaction_status" text NOT NULL DEFAULT 'pending' CHECK (transaction_status IN ('pending', 'success', 'error', 'cancelled', 'refunded')),
            "payment_time" timestamp with time zone,
            "bank_code" text,
            "transaction_no" text,
            "response_code" text,
            "created_at" timestamp with time zone DEFAULT now(),
            "updated_at" timestamp with time zone DEFAULT now(),
            UNIQUE("order_id"),
            UNIQUE("vnp_txn_ref")
        );
        
        -- Create trigger for updated_at
        CREATE TRIGGER update_vnpay_payments_updated_at
            BEFORE UPDATE ON "public"."vnpay_payments"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- Create order_history table to track order status changes if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'order_history' AND table_schema = 'public'
    ) THEN
        CREATE TABLE "public"."order_history" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "order_id" uuid NOT NULL REFERENCES "public"."orders"(id) ON DELETE CASCADE,
            "status" text NOT NULL,
            "note" text,
            "created_by" uuid REFERENCES auth.users(id),
            "created_at" timestamp with time zone DEFAULT now()
        );
    END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE IF EXISTS "public"."shipping_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."ghn_shipping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."vnpay_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "public"."order_history" ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for shipping addresses
DO $$
BEGIN
    -- Users can view their own shipping addresses
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipping_addresses' AND policyname = 'Users can view own shipping addresses'
    ) THEN
        CREATE POLICY "Users can view own shipping addresses" ON "public"."shipping_addresses"
        FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- Users can insert their own shipping addresses
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipping_addresses' AND policyname = 'Users can insert own shipping addresses'
    ) THEN
        CREATE POLICY "Users can insert own shipping addresses" ON "public"."shipping_addresses"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Users can update their own shipping addresses
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipping_addresses' AND policyname = 'Users can update own shipping addresses'
    ) THEN
        CREATE POLICY "Users can update own shipping addresses" ON "public"."shipping_addresses"
        FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Users can delete their own shipping addresses
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipping_addresses' AND policyname = 'Users can delete own shipping addresses'
    ) THEN
        CREATE POLICY "Users can delete own shipping addresses" ON "public"."shipping_addresses"
        FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Admins can view all shipping addresses
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipping_addresses' AND policyname = 'Admins can view all shipping addresses'
    ) THEN
        CREATE POLICY "Admins can view all shipping addresses" ON "public"."shipping_addresses"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;
END $$;

-- Create RLS Policies for orders
DO $$
BEGIN
    -- Users can view their own orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Users can view own orders'
    ) THEN
        CREATE POLICY "Users can view own orders" ON "public"."orders"
        FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- Users can create their own orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Users can insert own orders'
    ) THEN
        CREATE POLICY "Users can insert own orders" ON "public"."orders"
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Users can update their own orders (but only for certain statuses)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Users can update own pending orders'
    ) THEN
        CREATE POLICY "Users can update own pending orders" ON "public"."orders"
        FOR UPDATE USING (
            auth.uid() = user_id AND 
            status IN ('pending')
        ) WITH CHECK (
            auth.uid() = user_id AND 
            status IN ('pending', 'cancelled')
        );
    END IF;

    -- Admins can view all orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Admins can view all orders'
    ) THEN
        CREATE POLICY "Admins can view all orders" ON "public"."orders"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;

    -- Admins can update all orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Admins can update all orders'
    ) THEN
        CREATE POLICY "Admins can update all orders" ON "public"."orders"
        FOR UPDATE USING (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        )) WITH CHECK (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;
END $$;

-- Create RLS Policies for order items
DO $$
BEGIN
    -- Users can view their own order items
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_items' AND policyname = 'Users can view own order items'
    ) THEN
        CREATE POLICY "Users can view own order items" ON "public"."order_items"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_id AND orders.user_id = auth.uid()
        ));
    END IF;

    -- Users can insert their own order items
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_items' AND policyname = 'Users can insert own order items'
    ) THEN
        CREATE POLICY "Users can insert own order items" ON "public"."order_items"
        FOR INSERT WITH CHECK (EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_id AND orders.user_id = auth.uid()
        ));
    END IF;

    -- Admins can view all order items
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_items' AND policyname = 'Admins can view all order items'
    ) THEN
        CREATE POLICY "Admins can view all order items" ON "public"."order_items"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;

    -- Admins can update all order items
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_items' AND policyname = 'Admins can update all order items'
    ) THEN
        CREATE POLICY "Admins can update all order items" ON "public"."order_items"
        FOR UPDATE USING (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        )) WITH CHECK (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;
END $$;

-- Create RLS Policies for GHN shipping
DO $$
BEGIN
    -- Users can view their own shipping info
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ghn_shipping' AND policyname = 'Users can view own shipping info'
    ) THEN
        CREATE POLICY "Users can view own shipping info" ON "public"."ghn_shipping"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_id AND orders.user_id = auth.uid()
        ));
    END IF;

    -- Admins can view all shipping info
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ghn_shipping' AND policyname = 'Admins can view all shipping info'
    ) THEN
        CREATE POLICY "Admins can view all shipping info" ON "public"."ghn_shipping"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;

    -- Admins can insert shipping info
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ghn_shipping' AND policyname = 'Admins can insert shipping info'
    ) THEN
        CREATE POLICY "Admins can insert shipping info" ON "public"."ghn_shipping"
        FOR INSERT WITH CHECK (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;

    -- Admins can update shipping info
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ghn_shipping' AND policyname = 'Admins can update shipping info'
    ) THEN
        CREATE POLICY "Admins can update shipping info" ON "public"."ghn_shipping"
        FOR UPDATE USING (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        )) WITH CHECK (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;
END $$;

-- Create RLS Policies for VNPAY payments
DO $$
BEGIN
    -- Users can view their own payment info
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'vnpay_payments' AND policyname = 'Users can view own payment info'
    ) THEN
        CREATE POLICY "Users can view own payment info" ON "public"."vnpay_payments"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_id AND orders.user_id = auth.uid()
        ));
    END IF;

    -- Admins can view all payment info
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'vnpay_payments' AND policyname = 'Admins can view all payment info'
    ) THEN
        CREATE POLICY "Admins can view all payment info" ON "public"."vnpay_payments"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;

    -- System & Admins can insert payment info
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'vnpay_payments' AND policyname = 'System and admins can insert payment info'
    ) THEN
        CREATE POLICY "System and admins can insert payment info" ON "public"."vnpay_payments"
        FOR INSERT WITH CHECK (
            (auth.uid() IS NULL) OR
            EXISTS (
                SELECT 1 FROM admin_users
                WHERE admin_users.id = auth.uid()
            )
        );
    END IF;

    -- System & Admins can update payment info
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'vnpay_payments' AND policyname = 'System and admins can update payment info'
    ) THEN
        CREATE POLICY "System and admins can update payment info" ON "public"."vnpay_payments"
        FOR UPDATE USING (
            (auth.uid() IS NULL) OR
            EXISTS (
                SELECT 1 FROM admin_users
                WHERE admin_users.id = auth.uid()
            )
        ) WITH CHECK (
            (auth.uid() IS NULL) OR
            EXISTS (
                SELECT 1 FROM admin_users
                WHERE admin_users.id = auth.uid()
            )
        );
    END IF;
END $$;

-- Create RLS Policies for order history
DO $$
BEGIN
    -- Users can view their own order history
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_history' AND policyname = 'Users can view own order history'
    ) THEN
        CREATE POLICY "Users can view own order history" ON "public"."order_history"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_id AND orders.user_id = auth.uid()
        ));
    END IF;

    -- Users can insert order history for their own orders
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_history' AND policyname = 'Users can insert own order history'
    ) THEN
        CREATE POLICY "Users can insert own order history" ON "public"."order_history"
        FOR INSERT WITH CHECK (
            auth.uid() = created_by AND
            EXISTS (
                SELECT 1 FROM orders
                WHERE orders.id = order_id AND orders.user_id = auth.uid()
            )
        );
    END IF;

    -- Admins can view all order history
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_history' AND policyname = 'Admins can view all order history'
    ) THEN
        CREATE POLICY "Admins can view all order history" ON "public"."order_history"
        FOR SELECT USING (EXISTS (
            SELECT 1 FROM admin_users
            WHERE admin_users.id = auth.uid()
        ));
    END IF;

    -- Admins can insert order history for any order
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_history' AND policyname = 'Admins can insert any order history'
    ) THEN
        CREATE POLICY "Admins can insert any order history" ON "public"."order_history"
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM admin_users
                WHERE admin_users.id = auth.uid()
            )
        );
    END IF;
END $$;

-- Create a view that combines order data with shipping and payment for easier queries
CREATE OR REPLACE VIEW "public"."order_details" AS
SELECT 
    o.id,
    o.user_id,
    o.status,
    o.shipping_address_id,
    o.shipping_fee,
    o.subtotal,
    o.total,
    o.note,
    o.payment_method,
    o.payment_status,
    o.created_at,
    o.updated_at,
    gs.ghn_order_code,
    gs.expected_delivery_time,
    gs.status AS shipping_status,
    gs.tracking_url,
    vp.vnp_txn_ref,
    vp.transaction_status,
    vp.payment_time,
    vp.bank_code,
    sa.receiver_name,
    sa.phone,
    sa.province_name,
    sa.district_name,
    sa.ward_name,
    sa.address
FROM 
    "public"."orders" o
LEFT JOIN 
    "public"."ghn_shipping" gs ON o.id = gs.order_id
LEFT JOIN 
    "public"."vnpay_payments" vp ON o.id = vp.order_id
LEFT JOIN
    "public"."shipping_addresses" sa ON o.shipping_address_id = sa.id;

-- Create a trigger function to automatically add order history when order status changes
CREATE OR REPLACE FUNCTION add_order_history_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS NULL OR NEW.status <> OLD.status THEN
        INSERT INTO "public"."order_history" (order_id, status, created_by)
        VALUES (NEW.id, NEW.status, auth.uid());
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger
DROP TRIGGER IF EXISTS order_status_history_trigger ON "public"."orders";
CREATE TRIGGER order_status_history_trigger
AFTER INSERT OR UPDATE OF status ON "public"."orders"
FOR EACH ROW
EXECUTE FUNCTION add_order_history_on_status_change(); 