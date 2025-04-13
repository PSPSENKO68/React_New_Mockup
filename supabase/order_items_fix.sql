-- Fix order_items table structure
DO $$ 
BEGIN
  -- Đầu tiên, xóa ràng buộc khóa ngoại trên inventory_item_id nếu tồn tại
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'order_items_inventory_item_id_fkey'
    AND table_name = 'order_items'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.order_items DROP CONSTRAINT order_items_inventory_item_id_fkey;
  END IF;

  -- Kiểm tra và xóa ràng buộc khóa ngoại trên product_id nếu tồn tại
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'order_items_product_id_fkey'
    AND table_name = 'order_items'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.order_items DROP CONSTRAINT order_items_product_id_fkey;
  END IF;

  -- Kiểm tra và thêm cột design_id nếu chưa tồn tại
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'order_items' 
    AND column_name = 'design_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN design_id TEXT;
  END IF;

  -- Kiểm tra và thêm cột custom_design_url nếu chưa tồn tại
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'order_items' 
    AND column_name = 'custom_design_url'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN custom_design_url TEXT;
  END IF;

  -- Kiểm tra và thêm cột mockup_design_url nếu chưa tồn tại
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'order_items' 
    AND column_name = 'mockup_design_url'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN mockup_design_url TEXT;
  END IF;

  -- Kiểm tra xem cột product_id có tồn tại không
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'order_items' 
    AND column_name = 'product_id'
    AND table_schema = 'public'
  ) THEN
    -- Nếu không tồn tại product_id, kiểm tra xem inventory_item_id có tồn tại không
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_name = 'order_items' 
      AND column_name = 'inventory_item_id'
      AND table_schema = 'public'
    ) THEN
      -- Đổi tên cột inventory_item_id thành product_id
      ALTER TABLE public.order_items RENAME COLUMN inventory_item_id TO product_id;
    ELSE
      -- Nếu không có cả hai, thêm cột product_id
      ALTER TABLE public.order_items ADD COLUMN product_id UUID;
    END IF;
  END IF;

  -- Đảm bảo cột product_id không có ràng buộc NOT NULL
  ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;
END $$; 