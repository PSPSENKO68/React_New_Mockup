-- Xóa cột design_id và product_id khỏi bảng order_items
ALTER TABLE order_items 
DROP COLUMN design_id,
DROP COLUMN product_id; 