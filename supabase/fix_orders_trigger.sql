-- Fix for the "relation 'public.order_history' does not exist" error
-- This script removes the database trigger that's trying to insert into the deleted order_history table

-- Drop the trigger first
DROP TRIGGER IF EXISTS order_status_history_trigger ON "public"."orders";

-- Drop the function that was used by the trigger
DROP FUNCTION IF EXISTS add_order_history_on_status_change();

-- Recreate a dummy function that doesn't do anything (in case there are other references to it)
CREATE OR REPLACE FUNCTION add_order_history_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- This function doesn't do anything anymore since order_history table is gone
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a view for order_details that doesn't reference order_history
CREATE OR REPLACE VIEW "public"."order_details" AS
SELECT 
    o.id,
    o.user_id,
    o.anonymous_id,
    o.status,
    o.shipping_address,
    o.full_name,
    o.email,
    o.phone_number,
    o.shipping_fee,
    o.subtotal,
    o.total,
    o.notes,
    o.payment_method,
    o.payment_status,
    o.has_ghn_order,
    o.ghn_code,
    o.created_at,
    o.updated_at,
    vp.vnp_txn_ref,
    vp.transaction_status,
    vp.payment_time,
    vp.bank_code
FROM 
    "public"."orders" o
LEFT JOIN 
    "public"."vnpay_payments" vp ON o.id = vp.order_id; 