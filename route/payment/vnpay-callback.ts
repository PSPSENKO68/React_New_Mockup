import { Request, Response } from 'express';
import { supabase } from '../../src/lib/supabase';
import VNPayService from '../../src/lib/vnpayService';
import GHNService from '../../src/lib/ghnService';
import crypto from 'crypto';

/**
 * API callback từ VNPay sau khi thanh toán hoàn tất (IPN - Instant Payment Notification)
 * VNPay sẽ gọi endpoint này để thông báo kết quả thanh toán
 */
export async function handlePaymentIPN(req: Request, res: Response) {
  try {
    // VNPay thường gửi thông tin qua query params
    const vnpParams = req.query as Record<string, string>;
    console.log('VNPay IPN callback received:', vnpParams);
    
    // Xác thực callback từ VNPay được thực hiện trong verifyPaymentReturn
    // Chúng ta sẽ sử dụng phương thức này để xác thực
    try {
      const verificationResult = await VNPayService.verifyPaymentReturn(vnpParams);
      if (!verificationResult.isSuccess) {
        console.error('Invalid VNPay payment verification in IPN callback');
        return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
      }
    } catch (error) {
      console.error('Error verifying VNPay payment:', error);
      return res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
    }
    
    // Lấy thông tin từ callback
    const orderId = vnpParams['vnp_TxnRef'];
    const responseCode = vnpParams['vnp_ResponseCode'];
    const transactionStatus = vnpParams['vnp_TransactionStatus'];
    
    // Kiểm tra kết quả thanh toán
    const paymentSuccess = responseCode === '00' && transactionStatus === '00';
    
    // Cập nhật trạng thái thanh toán trong database
    if (orderId) {
      const paymentStatus = paymentSuccess ? 'completed' : 'failed';
      
      await supabase
        .from('orders')
        .update({ 
          payment_status: paymentStatus,
          status: paymentStatus === 'completed' ? 'processing' : 'payment_failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      console.log(`Updated order ${orderId} payment status to ${paymentStatus}`);
      
      // Nếu thanh toán thành công và đơn hàng có vận chuyển qua GHN, tạo đơn GHN
      if (paymentSuccess) {
        try {
          // Lấy thông tin đơn hàng
          const { data: order } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
          
          if (order && order.shipping_method === 'ghn' && !order.ghn_order_code) {
            // Lấy thông tin shipping
            const { data: shipping } = await supabase
              .from('shipping_info')
              .select('*')
              .eq('order_id', orderId)
              .single();
            
            if (shipping) {
              // Đơn hàng đã thanh toán thành công, tạo đơn vận chuyển GHN
              // Chỉ triển khai xử lý logic khi cần, có thể bổ sung sau
              console.log(`Payment successful for order ${orderId}, ready to create GHN shipping`);
            }
          }
        } catch (err) {
          console.error('Error processing GHN order after payment:', err);
          // Không ảnh hưởng đến phản hồi cho VNPay
        }
      }
    }
    
    // VNPay yêu cầu trả về RspCode=00 để xác nhận đã nhận được thông báo
    return res.status(200).json({ RspCode: '00', Message: 'Confirmed' });
  } catch (error: any) {
    console.error('Error handling VNPay IPN callback:', error);
    // Vẫn trả về định dạng mà VNPay mong đợi
    return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
}

/**
 * API redirect từ VNPay khi người dùng hoàn thành thanh toán
 * Người dùng sẽ được chuyển hướng về endpoint này sau khi hoàn tất quy trình thanh toán
 */
export async function handlePaymentReturn(req: Request, res: Response) {
  try {
    // VNPay thường gửi thông tin qua query params
    const vnpParams = req.query as Record<string, string>;
    
    // Xác thực và xử lý kết quả thanh toán
    const result = await VNPayService.verifyPaymentReturn(vnpParams);
    
    // Trích xuất orderId để chuyển hướng
    const orderId = result.orderId || vnpParams['vnp_TxnRef'];
    
    // Nếu thanh toán thành công, chuyển hướng về trang thành công
    if (result.isSuccess) {
      return res.redirect(`/order-confirmation/${orderId}?status=success`);
    } else {
      // Nếu thanh toán thất bại, chuyển hướng về trang thất bại
      return res.redirect(`/order-confirmation/${orderId}?status=failed`);
    }
  } catch (error: any) {
    console.error('Error handling VNPay payment return:', error);
    return res.redirect('/payment/error');
  }
} 