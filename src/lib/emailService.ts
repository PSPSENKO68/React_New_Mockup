import { supabase } from './supabase';

interface OrderItem {
  id: string;
  inventory_item_id: string;
  quantity: number;
  price: number;
  custom_design_url?: string | null;
  mockup_design_url?: string | null;
  inventory_item?: {
    name: string;
    image_url: string;
  } | null;
}

interface Order {
  id: string;
  full_name: string;
  email: string;
  shipping_address: string;
  phone_number: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

/**
 * Gửi email xác nhận đơn hàng đến khách hàng
 * @param orderId ID của đơn hàng
 * @returns Success status and message
 */
export async function sendOrderConfirmationEmail(orderId: string): Promise<{ success: boolean, message: string }> {
  try {
    // 1. Lấy thông tin đơn hàng từ database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, full_name, email, shipping_address, phone_number, 
        total, subtotal, shipping_fee, payment_method, payment_status, 
        status, created_at,
        order_items (
          id, inventory_item_id, quantity, price, custom_design_url, mockup_design_url,
          inventory_item:inventory_items (name, image_url)
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;
    if (!order) throw new Error('Không tìm thấy đơn hàng');

    // 2. Tạo nội dung email với thông tin đơn hàng
    const orderConfirmationTemplate = generateOrderConfirmationTemplate(order as unknown as Order);

    // 3. Gửi email sử dụng Supabase
    const { error: emailError } = await supabase.functions.invoke('send-order-confirmation', {
      body: {
        to: order.email,
        subject: `Đơn hàng của bạn đã được xác nhận - #${order.id}`,
        html: orderConfirmationTemplate,
        orderId: order.id
      }
    });

    if (emailError) throw emailError;

    // 4. Cập nhật trạng thái gửi email trong database (nếu cần)
    await supabase
      .from('orders')
      .update({ email_sent: true })
      .eq('id', orderId);

    return {
      success: true,
      message: `Đã gửi email xác nhận đơn hàng thành công đến ${order.email}`
    };
  } catch (error: any) {
    console.error('Lỗi khi gửi email xác nhận đơn hàng:', error);
    return {
      success: false,
      message: error.message || 'Đã xảy ra lỗi khi gửi email xác nhận đơn hàng'
    };
  }
}

/**
 * Tạo nội dung HTML cho email xác nhận đơn hàng
 * @param order Thông tin đơn hàng
 * @returns HTML string
 */
function generateOrderConfirmationTemplate(order: Order): string {
  // Tạo danh sách sản phẩm
  const orderItemsHtml = order.order_items.map(item => {
    const itemName = item.inventory_item?.name || 'Sản phẩm';
    const itemImage = item.mockup_design_url || item.custom_design_url || item.inventory_item?.image_url || '';
    
    return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <img src="${getPublicUrl(itemImage)}" alt="${itemName}" style="width: 60px; height: auto; border-radius: 4px;">
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${itemName}
          ${item.custom_design_url ? '<br><span style="font-size: 12px; color: #666;">Thiết kế tùy chỉnh</span>' : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // Định dạng ngày đặt hàng
  const orderDate = new Date(order.created_at);
  const formattedDate = orderDate.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Trạng thái thanh toán và đơn hàng
  const paymentStatusColor = order.payment_status === 'completed' ? '#34D399' : '#F87171';
  const orderStatusColor = order.status === 'completed' ? '#34D399' : 
                           order.status === 'pending' ? '#FBBF24' : '#9CA3AF';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Xác nhận đơn hàng</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; background-color: #f9f9f9;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background-color: #111; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Cảm ơn bạn đã đặt hàng</h1>
        </div>
        
        <!-- Order Info -->
        <div style="padding: 20px;">
          <p style="margin-bottom: 20px; font-size: 16px;">Xin chào <strong>${order.full_name}</strong>,</p>
          <p style="margin-bottom: 20px; font-size: 16px;">Đơn hàng của bạn đã được xác nhận. Dưới đây là thông tin chi tiết:</p>
          
          <!-- Order Details -->
          <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; background-color: #f5f5f5; font-weight: bold;">Mã đơn hàng:</td>
              <td style="padding: 10px; background-color: #f5f5f5;">#${order.id}</td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold;">Ngày đặt hàng:</td>
              <td style="padding: 10px;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 10px; background-color: #f5f5f5; font-weight: bold;">Trạng thái thanh toán:</td>
              <td style="padding: 10px; background-color: #f5f5f5;">
                <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background-color: ${paymentStatusColor}; color: white; font-size: 12px;">
                  ${order.payment_status === 'completed' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; font-weight: bold;">Trạng thái đơn hàng:</td>
              <td style="padding: 10px;">
                <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background-color: ${orderStatusColor}; color: white; font-size: 12px;">
                  ${order.status === 'completed' ? 'Đã hoàn thành' : 
                    order.status === 'pending' ? 'Đang xử lý' : 
                    order.status === 'shipped' ? 'Đang giao hàng' : order.status}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px; background-color: #f5f5f5; font-weight: bold;">Phương thức thanh toán:</td>
              <td style="padding: 10px; background-color: #f5f5f5;">
                ${order.payment_method === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 
                  order.payment_method === 'vnpay' ? 'Thanh toán qua VNPAY' : order.payment_method}
              </td>
            </tr>
          </table>
          
          <!-- Shipping Address -->
          <div style="margin-bottom: 30px;">
            <h2 style="font-size: 18px; margin-bottom: 10px; color: #555;">Địa chỉ giao hàng</h2>
            <div style="padding: 15px; border: 1px solid #eee; border-radius: 4px;">
              <p style="margin: 0 0 5px 0;"><strong>${order.full_name}</strong></p>
              <p style="margin: 0 0 5px 0;">${order.shipping_address}</p>
              <p style="margin: 0 0 5px 0;">Điện thoại: ${order.phone_number}</p>
              <p style="margin: 0;">Email: ${order.email}</p>
            </div>
          </div>
          
          <!-- Order Items -->
          <h2 style="font-size: 18px; margin-bottom: 10px; color: #555;">Sản phẩm đã đặt</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 10px; text-align: left;">Hình ảnh</th>
                <th style="padding: 10px; text-align: left;">Sản phẩm</th>
                <th style="padding: 10px; text-align: center;">Số lượng</th>
                <th style="padding: 10px; text-align: right;">Giá</th>
              </tr>
            </thead>
            <tbody>
              ${orderItemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Tạm tính:</td>
                <td style="padding: 10px; text-align: right;">$${order.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Phí vận chuyển:</td>
                <td style="padding: 10px; text-align: right;">$${order.shipping_fee.toFixed(2)}</td>
              </tr>
              <tr style="font-size: 18px;">
                <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; border-top: 2px solid #eee;">Tổng cộng:</td>
                <td style="padding: 10px; text-align: right; font-weight: bold; border-top: 2px solid #eee;">$${order.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          
          <!-- Next Steps -->
          <div style="margin-bottom: 30px; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
            <h2 style="font-size: 18px; margin-bottom: 10px; color: #555;">Các bước tiếp theo</h2>
            <p style="margin: 0 0 10px 0;">Đơn hàng của bạn sẽ được xử lý và gửi đi trong thời gian sớm nhất. Bạn sẽ nhận được thông báo khi đơn hàng được gửi đi.</p>
            <p style="margin: 0;">Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi qua email: <a href="mailto:support@lylycase.com" style="color: #4F46E5;">support@lylycase.com</a></p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 0 0 10px 0;">© 2024 LYLY CASE. Tất cả các quyền được bảo lưu.</p>
          <p style="margin: 0;">Địa chỉ: 123 Đường ABC, Phường XYZ, Quận 1, TP. Hồ Chí Minh</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Lấy URL công khai từ Supabase Storage nếu là đường dẫn file
 * @param path Đường dẫn file trong Supabase Storage
 * @returns Public URL
 */
function getPublicUrl(path: string): string {
  if (!path) return '';
  
  // Nếu là URL đầy đủ, trả về luôn
  if (path.startsWith('http')) return path;
  
  // Nếu là path trong Supabase Storage
  if (path.startsWith('order/') || path.startsWith('temp/')) {
    const { data } = supabase.storage
      .from('case-assets')
      .getPublicUrl(path);
    
    return data.publicUrl;
  }
  
  return path;
} 