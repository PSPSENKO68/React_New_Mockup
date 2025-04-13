/*
  # Create inventory management tables

  1. New Tables
    - `phone_models`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `case_types`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `inventory_items`
      - `id` (uuid, primary key)
      - `phone_model_id` (uuid, foreign key)
      - `case_type_id` (uuid, foreign key)
      - `quantity` (integer)
      - `reorder_point` (integer)
      - `price` (decimal)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for admin access
*/

-- Create phone_models table
CREATE TABLE IF NOT EXISTS phone_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create case_types table
CREATE TABLE IF NOT EXISTS case_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_model_id uuid REFERENCES phone_models(id) ON DELETE CASCADE,
  case_type_id uuid REFERENCES case_types(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  reorder_point integer NOT NULL DEFAULT 10,
  price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(phone_model_id, case_type_id)
);

-- Enable RLS
ALTER TABLE phone_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Create policies for phone_models
CREATE POLICY "Allow admin read phone_models"
  ON phone_models
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Allow admin insert phone_models"
  ON phone_models
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Allow admin update phone_models"
  ON phone_models
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Allow admin delete phone_models"
  ON phone_models
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

-- Create policies for case_types
CREATE POLICY "Allow admin read case_types"
  ON case_types
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Allow admin insert case_types"
  ON case_types
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Allow admin update case_types"
  ON case_types
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Allow admin delete case_types"
  ON case_types
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

-- Create policies for inventory_items
CREATE POLICY "Allow admin read inventory_items"
  ON inventory_items
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Allow admin insert inventory_items"
  ON inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Allow admin update inventory_items"
  ON inventory_items
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

CREATE POLICY "Allow admin delete inventory_items"
  ON inventory_items
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  ));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_phone_models_updated_at
  BEFORE UPDATE ON phone_models
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_types_updated_at
  BEFORE UPDATE ON case_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial case types
INSERT INTO case_types (name, description) VALUES
  ('Clear Case', 'Transparent case that shows off your phone''s original design'),
  ('Silicone Case', 'Soft-touch silicone case with excellent grip'),
  ('Tough Case', 'Heavy-duty protection for maximum durability')
ON CONFLICT (name) DO NOTHING;

-- Insert some popular phone models
INSERT INTO phone_models (name, active) VALUES
  ('iPhone 15 Pro Max', true),
  ('iPhone 15 Pro', true),
  ('iPhone 15 Plus', true),
  ('iPhone 15', true),
  ('iPhone 14 Pro Max', true),
  ('iPhone 14 Pro', true),
  ('Samsung Galaxy S24 Ultra', true),
  ('Samsung Galaxy S24+', true),
  ('Samsung Galaxy S24', true)
ON CONFLICT (name) DO NOTHING;