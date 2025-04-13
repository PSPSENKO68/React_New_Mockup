# Hướng Dẫn Tích Hợp Webhook và Callback

Tài liệu này hướng dẫn cách thiết lập các webhook/callback để tích hợp website với các dịch vụ bên ngoài như Giao Hàng Nhanh (GHN) và VNPay.

## Giao Hàng Nhanh (GHN)

GHN hỗ trợ webhook để cập nhật trạng thái đơn hàng tự động. Khi có cập nhật về trạng thái đơn hàng (ví dụ: đang lấy hàng, đang giao, đã giao, v.v.), GHN sẽ gửi thông báo đến URL webhook đã đăng ký.

### Thiết lập Webhook GHN

1. **Cấu hình trong GHN:**
   
   Cung cấp cho GHN các thông tin sau để họ cấu hình webhook:
   - ClientID của bạn
   - URL Webhook: `https://react-new-mockup.vercel.app/api/webhooks/ghn/status`
   - Môi trường: Production (hoặc Staging nếu đang test)
   - Tên công ty của bạn

   Liên hệ với GHN qua email: `api@ghn.vn` để yêu cầu cấu hình.

2. **Endpoint Webhook:**
   
   Server của bạn đã cấu hình sẵn endpoint để nhận và xử lý webhook từ GHN:
   - URL: `/api/webhooks/ghn/status` (POST)
   - Phương thức: POST
   - Xử lý: Cập nhật trạng thái đơn hàng trong database dựa trên thông tin từ GHN

3. **Test Webhook:**
   
   Sử dụng endpoint test để kiểm tra kết nối:
   - URL: `/api/webhooks/ghn/test` (POST)
   - Phương thức: POST

### Trạng thái đơn hàng GHN

GHN sẽ gửi cập nhật với các trạng thái sau:

- `ready_to_pick`: Đã tiếp nhận đơn hàng
- `picking`: Đang lấy hàng
- `picked`: Đã lấy hàng
- `storing`: Đang lưu kho
- `delivering`: Đang giao hàng
- `delivered`: Đã giao hàng
- `delivery_fail`: Giao hàng không thành công
- `waiting_to_return`: Chờ hoàn hàng
- `return`: Đang hoàn hàng
- `returned`: Đã hoàn hàng
- `cancel`: Đã hủy
- `exception`: Ngoại lệ

## VNPay

VNPay hỗ trợ hai loại callback:

1. **IPN (Instant Payment Notification):** VNPay gửi thông báo kết quả thanh toán trực tiếp đến server.
2. **Return URL:** Người dùng được chuyển hướng về URL này sau khi hoàn tất quy trình thanh toán.

### Thiết lập Callback VNPay

1. **Cấu hình trong VNPay:**

   Cập nhật các thông tin trong tài khoản VNPay của bạn:
   - IPN URL: `https://react-new-mockup.vercel.app/api/webhooks/vnpay/ipn`
   - Return URL: `https://react-new-mockup.vercel.app/api/webhooks/vnpay/return`

2. **Endpoint Callback:**

   Server của bạn đã cấu hình sẵn các endpoint để xử lý callback từ VNPay:
   - IPN URL: `/api/webhooks/vnpay/ipn` (GET)
   - Return URL: `/api/webhooks/vnpay/return` (GET)

3. **Xử lý callback:**

   - IPN: Server xác thực và cập nhật trạng thái thanh toán trong database
   - Return URL: Chuyển hướng người dùng đến trang xác nhận đơn hàng với thông tin phù hợp

## Cách triển khai trên Express.js

Đảm bảo các endpoint webhook/callback được thêm vào Express router của bạn:

```javascript
// server.js hoặc app.js
import express from 'express';
import { 
  ghnStatusWebhook, 
  ghnTestWebhook, 
  vnpayIPNWebhook, 
  vnpayReturnWebhook 
} from './route/webhooks';

const app = express();

// GHN webhooks
app.post('/api/webhooks/ghn/status', ghnStatusWebhook);
app.post('/api/webhooks/ghn/test', ghnTestWebhook);

// VNPay callbacks
app.get('/api/webhooks/vnpay/ipn', vnpayIPNWebhook);
app.get('/api/webhooks/vnpay/return', vnpayReturnWebhook);

// ... các route khác
```

## Xử lý hủy đơn hàng

### 1. Khi người dùng hủy đơn trên website:

```javascript
// Hàm xử lý khi người dùng hủy đơn hàng
async function cancelOrder(orderId, ghnOrderCode) {
  try {
    // Hủy đơn hàng trên GHN
    await GHNService.cancelOrder(ghnOrderCode);
    
    // Cập nhật trạng thái trong database
    await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);
      
    await supabase
      .from('shipping')
      .update({ status: 'cancelled' })
      .eq('orderCode', ghnOrderCode);
      
    return { success: true };
  } catch (error) {
    console.error('Error cancelling order:', error);
    return { success: false, error: error.message };
  }
}
```

### 2. Khi GHN hủy đơn:

GHN sẽ gửi webhook với status là `cancel` hoặc `exception`. Server của bạn sẽ tự động cập nhật trạng thái đơn hàng trong database thông qua xử lý webhook.

## Lưu ý bảo mật

1. **Xác thực webhook:**
   - Với VNPay: Kiểm tra chữ ký số trong mọi callback
   - Với GHN: Có thể thêm token xác thực trong header nếu cần

2. **HTTPS:**
   - Đảm bảo tất cả các endpoint webhook/callback đều được phục vụ qua HTTPS

3. **Kiểm soát lỗi:**
   - Luôn trả về response phù hợp (HTTP 200) ngay cả khi xử lý gặp lỗi, để tránh webhook bị gọi lại nhiều lần

## Kiểm tra và gỡ lỗi

1. **Logs:**
   - Luôn ghi log đầy đủ thông tin nhận được từ webhook/callback
   - Thêm các thông tin gỡ lỗi chi tiết trong quá trình xử lý

2. **Testing:**
   - Sử dụng công cụ như Postman để mô phỏng webhook/callback
   - Thiết lập môi trường staging/sandbox trước khi đưa vào production 