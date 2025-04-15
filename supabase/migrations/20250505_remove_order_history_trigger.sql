-- This migration removes the order_history trigger since the order_history table has been deleted

-- Drop the trigger that updates order_history
DROP TRIGGER IF EXISTS order_status_history_trigger ON "public"."orders";

-- Drop the function that was used by the trigger
DROP FUNCTION IF EXISTS add_order_history_on_status_change();

-- Remove any references to order_history in views or functions
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
    gs.expected_delivery_time,
    gs.status AS shipping_status,
    gs.tracking_url,
    vp.vnp_txn_ref,
    vp.transaction_status,
    vp.payment_time,
    vp.bank_code
FROM 
    "public"."orders" o
LEFT JOIN 
    "public"."ghn_shipping" gs ON o.id = gs.order_id
LEFT JOIN 
    "public"."vnpay_payments" vp ON o.id = vp.order_id; 