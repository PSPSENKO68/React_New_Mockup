-- Đây là file thiết lập chính sách bảo mật hàng (Row Level Security) cho Supabase
-- Sao chép và chạy các câu lệnh này trong SQL Editor của Supabase Studio

-- 1. Kích hoạt RLS cho bảng orders và order_items
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vnpay_payments ENABLE ROW LEVEL SECURITY;

-- 2. Tạo chính sách cho bảng orders
-- Chính sách cho phép đọc (SELECT) dữ liệu
CREATE POLICY "Người dùng có thể xem đơn hàng của họ" ON public.orders
FOR SELECT USING (auth.uid() IS NOT NULL AND anonymous_id = auth.uid());

-- Chính sách cho phép thêm (INSERT) dữ liệu
-- Cho phép tất cả người dùng có thể tạo đơn hàng mới và thiết lập anonymous_id
CREATE POLICY "Cho phép người dùng tạo đơn hàng mới" ON public.orders
FOR INSERT WITH CHECK (true);

-- Chính sách cho phép cập nhật (UPDATE) dữ liệu
CREATE POLICY "Người dùng có thể cập nhật đơn hàng của họ" ON public.orders
FOR UPDATE USING (auth.uid() IS NOT NULL AND anonymous_id = auth.uid());

-- 3. Tạo chính sách cho bảng order_items
-- Chính sách cho phép đọc (SELECT) dữ liệu
CREATE POLICY "Người dùng có thể xem các mục đơn hàng của họ" ON public.order_items
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE public.orders.id = public.order_items.order_id
    AND public.orders.anonymous_id = auth.uid()
  )
);

-- Chính sách cho phép thêm (INSERT) dữ liệu
CREATE POLICY "Cho phép người dùng thêm mục đơn hàng" ON public.order_items
FOR INSERT WITH CHECK (true);

-- 4. Tạo chính sách cho bảng vnpay_payments
-- Chính sách cho phép đọc (SELECT) dữ liệu
CREATE POLICY "Người dùng có thể xem thông tin thanh toán" ON public.vnpay_payments
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE public.orders.id = public.vnpay_payments.order_id
    AND public.orders.anonymous_id = auth.uid()
  )
);

-- Chính sách cho phép thêm (INSERT) dữ liệu
CREATE POLICY "Cho phép tạo thông tin thanh toán mới" ON public.vnpay_payments
FOR INSERT WITH CHECK (true);

-- Chính sách cho phép cập nhật (UPDATE) dữ liệu 
CREATE POLICY "Cho phép cập nhật thông tin thanh toán" ON public.vnpay_payments
FOR UPDATE USING (true);

-- 5. Tạo vai trò cho khách hàng không đăng nhập (anonymous)
-- Vai trò anonymous đã được tạo sẵn bởi Supabase

-- 6. Tạo chính sách cho bảng inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép đọc thông tin sản phẩm tồn kho" ON public.inventory_items
FOR SELECT USING (true);

-- 7. Tạo chính sách cho bảng phone_models và case_types
ALTER TABLE phone_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép đọc thông tin điện thoại" ON public.phone_models
FOR SELECT USING (true);

CREATE POLICY "Cho phép đọc thông tin loại ốp lưng" ON public.case_types
FOR SELECT USING (true); 