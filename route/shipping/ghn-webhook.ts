import { Request, Response } from 'express';
import { supabase } from '../../src/lib/supabase';
import GHNService from '../../src/lib/ghnService';

/**
 * API callback từ GHN khi trạng thái đơn hàng thay đổi
 * Endpoint này sẽ được GHN gọi mỗi khi có cập nhật về trạng thái đơn hàng
 */
export async function handleStatusCallback(req: Request, res: Response) {
  try {
    const data = req.body;
    console.log('GHN Callback received:', JSON.stringify(data, null, 2));
    
    // Xác thực request từ GHN (có thể thêm cơ chế xác thực sau)
    
    // Xử lý dữ liệu và cập nhật trạng thái đơn trong database
    if (data.OrderCode && data.Status) {
      const orderCode = data.OrderCode;
      const status = data.Status;
      const mappedStatus = GHNService.mapGHNStatus(status);
      
      console.log(`Updating order with GHN code ${orderCode} to status: ${mappedStatus}`);
      
      // Cập nhật trạng thái trong bảng shipping
      await supabase
        .from('shipping')
        .update({ status: mappedStatus })
        .eq('orderCode', orderCode);
      
      // Lấy orderId từ bảng shipping
      const { data: shippingData } = await supabase
        .from('shipping')
        .select('orderId')
        .eq('orderCode', orderCode)
        .single();
      
      if (shippingData?.orderId) {
        // Cập nhật trạng thái đơn hàng chính
        await supabase
          .from('orders')
          .update({ 
            status: mappedStatus === 'delivered' ? 'completed' : 
                   (mappedStatus === 'cancelled' || mappedStatus === 'return') ? 'cancelled' : 'processing',
            shipping_status: mappedStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', shippingData.orderId);
          
        console.log(`Updated main order ${shippingData.orderId} status based on GHN callback`);
      }
    }
    
    // GHN yêu cầu trả về status code 200 để xác nhận đã nhận được callback
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error handling GHN callback:', error);
    // Vẫn trả về 200 để GHN không gửi lại callback
    return res.status(200).json({ success: false, message: error.message });
  }
}

/**
 * Xử lý webhook test để kiểm tra kết nối
 * Endpoint này giúp kiểm tra xem webhook đã được cấu hình đúng chưa
 */
export async function handleTestCallback(req: Request, res: Response) {
  try {
    console.log('GHN Test Callback received:', req.body);
    
    // Luôn trả về thành công cho request test
    return res.status(200).json({ success: true, message: 'Webhook test successful' });
  } catch (error: any) {
    console.error('Error handling GHN test callback:', error);
    return res.status(200).json({ success: false, message: error.message });
  }
} 