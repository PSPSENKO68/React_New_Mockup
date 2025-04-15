-- Add proof_image_url and has_ghn_order columns to orders table

ALTER TABLE orders ADD COLUMN IF NOT EXISTS proof_image_url text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_ghn_order boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ghn_code text; 