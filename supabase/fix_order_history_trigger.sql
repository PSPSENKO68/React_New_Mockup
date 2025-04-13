-- Fix the trigger function to handle both anonymous and authenticated users
CREATE OR REPLACE FUNCTION add_order_history_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Try to get current authenticated user
    current_user_id := auth.uid();
    
    IF OLD.status IS NULL OR NEW.status <> OLD.status THEN
        -- Insert without created_by if no authenticated user
        IF current_user_id IS NULL THEN
            INSERT INTO "public"."order_history" (order_id, status)
            VALUES (NEW.id, NEW.status);
        ELSE
            INSERT INTO "public"."order_history" (order_id, status, created_by)
            VALUES (NEW.id, NEW.status, current_user_id);
        END IF;
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Fallback if any error occurs (e.g., auth.uid() not available or other issues)
        INSERT INTO "public"."order_history" (order_id, status)
        VALUES (NEW.id, NEW.status);
        RETURN NEW;
END;
$$ language 'plpgsql'; 