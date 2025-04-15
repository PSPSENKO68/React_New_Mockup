-- Sửa quyền truy cập cho bảng user_profiles
DO $$
BEGIN
    -- Cho phép người dùng ẩn danh (anon) tạo user_profiles
    DROP POLICY IF EXISTS "Anon users can insert profiles" ON "public"."user_profiles";
    
    CREATE POLICY "Anon users can insert profiles" ON "public"."user_profiles"
    FOR INSERT TO anon
    WITH CHECK (true);
    
    -- Cho phép người dùng ẩn danh (anon) cập nhật user_profiles
    DROP POLICY IF EXISTS "Anon users can update profiles" ON "public"."user_profiles";
    
    CREATE POLICY "Anon users can update profiles" ON "public"."user_profiles"
    FOR UPDATE TO anon
    WITH CHECK (true);
END $$;

-- Đảm bảo cột user_id tồn tại trên bảng orders và có kiểu dữ liệu là text
DO $$
BEGIN
    -- Kiểm tra nếu cột user_id không tồn tại trong bảng orders
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        -- Thêm cột user_id với kiểu dữ liệu text
        ALTER TABLE public.orders ADD COLUMN user_id TEXT;
    ELSE
        -- Đảm bảo kiểu dữ liệu là text
        ALTER TABLE public.orders ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
    END IF;
END $$;

-- Cập nhật RLS policy cho bảng orders để anonymous user có thể cập nhật orders của họ
DO $$
BEGIN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Anonymous users can update orders" ON "public"."orders";
    
    -- Create new policy for anonymous orders
    CREATE POLICY "Anonymous users can update orders" ON "public"."orders"
    FOR UPDATE TO anon
    USING (anonymous_id IS NOT NULL);
END $$; 