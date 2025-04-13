import { Request, Response } from 'express';
import { supabase } from '../../src/lib/supabase';
import VNPayService from '../../src/lib/vnpayService';

/**
 * API tạo URL thanh toán VNPAY
 */
export async function createPaymentUrl(req: Request, res: Response) {
  try {
    const { orderId, amount, orderInfo } = req.body;
    
    if (!orderId || !amount || !orderInfo) {
      return res.status(400).json({
        success: false,
        message: 'orderId, amount and orderInfo are required'
      });
    }
    
    // Lấy địa chỉ IP của client
    const clientIp = req.headers['x-forwarded-for'] || 
                    req.socket.remoteAddress || 
                    '127.0.0.1';
    
    // Tạo URL thanh toán
    const result = VNPayService.createPaymentUrl({
      orderId,
      amount: Number(amount),
      orderInfo,
      clientIp: Array.isArray(clientIp) ? clientIp[0] : String(clientIp)
    });
    
    // Cập nhật trạng thái đơn hàng
    await supabase
      .from('orders')
      .update({ payment_method: 'vnpay' })
      .eq('id', orderId);
    
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error creating VNPAY payment URL:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * API callback từ VNPAY sau khi thanh toán
 */
export async function handlePaymentReturn(req: Request, res: Response) {
  try {
    // Xác thực và xử lý kết quả thanh toán
    const vnpParams = req.query as Record<string, string>;
    const result = await VNPayService.verifyPaymentReturn(vnpParams);
    
    // Nếu thanh toán thành công, chuyển hướng về trang thành công
    if (result.isSuccess) {
      return res.redirect(`/payment/success?orderId=${result.orderId}`);
    } else {
      // Nếu thanh toán thất bại, chuyển hướng về trang thất bại
      return res.redirect(`/payment/failed?orderId=${result.orderId}`);
    }
  } catch (error: any) {
    console.error('Error handling VNPAY payment return:', error);
    return res.redirect('/payment/error');
  }
}

/**
 * API kiểm tra trạng thái thanh toán VNPAY
 */
export async function checkTransactionStatus(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }
    
    const result = await VNPayService.checkTransactionStatus(orderId);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error checking VNPAY transaction status:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
} 