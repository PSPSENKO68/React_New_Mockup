export interface OrderDetail {
  id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  shipping_fee: number;
  subtotal: number;
  total: number;
  created_at: string;
  shipping_status?: string;
  ghn_order_code?: string;
  tracking_url?: string;
  expected_delivery_time?: string;
  updated_at: string;
  user_id?: string;
  anonymous_id?: string;
  email?: string;
  full_name?: string;
  has_ghn_order?: boolean;
  ghn_code?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  inventory_item_id: string;
  quantity: number;
  price: number;
  custom_design_url?: string;
  mockup_design_url?: string;
  created_at?: string;
  inventory_items?: {
    phone_models?: {
      name: string;
    };
    case_types?: {
      name: string;
    };
  };
} 