import { VNPay, VnpLocale, ProductCode, ReturnQueryFromVNPay } from 'vnpay';
import { supabase } from './supabase';
import { moveFilesFromTempToOrder, updateOrderItemFilePaths } from '../utils/fileStorage';

// Khởi tạo client VNPAY
const vnpay = new VNPay({
  tmnCode: import.meta.env.VITE_VNPAY_TMN_CODE || '',
  secureSecret: import.meta.env.VITE_VNPAY_HASH_SECRET || '',
  vnpayHost: import.meta.env.VITE_VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  testMode: import.meta.env.VITE_APP_ENV !== 'production',
});

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  orderInfo: string;
  clientIp: string;
  locale?: string;
}

/**
 * Service tương tác với VNPAY API
 */
export const VNPayService = {
  /**
   * Tạo URL thanh toán
   */
  createPaymentUrl(params: CreatePaymentParams) {
    try {
      // Tạo mã giao dịch
      const txnRef = `${params.orderId}_${Date.now()}`;
      
      // Tạo URL thanh toán
      const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: params.amount * 100, // VNPAY yêu cầu số tiền * 100
        vnp_IpAddr: params.clientIp,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: params.orderInfo,
        vnp_OrderType: ProductCode.Other,
        vnp_Locale: (params.locale || 'vn') as VnpLocale,
        vnp_ReturnUrl: import.meta.env.VITE_VNPAY_RETURN_URL,
      });
      
      // Lưu thông tin giao dịch vào database
      this.savePaymentInfo(params.orderId, txnRef, params.amount);
      
      return { paymentUrl, txnRef };
    } catch (error) {
      console.error('Error creating payment URL:', error);
      throw error;
    }
  },

  /**
   * Lưu thông tin thanh toán vào database
   */
  async savePaymentInfo(orderId: string, txnRef: string, amount: number) {
    try {
      const { error } = await supabase.from('vnpay_payments').insert([
        {
          order_id: orderId,
          vnp_txn_ref: txnRef,
          amount: amount,
          transaction_status: 'pending',
        },
      ]);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error saving payment info:', error);
      throw error;
    }
  },

  /**
   * Xác thực và xử lý kết quả thanh toán
   */
  async verifyPaymentReturn(vnpParams: Record<string, string>) {
    try {
      // Kiểm tra tính hợp lệ của response từ VNPAY
      // Ép kiểu dữ liệu để tương thích với ReturnQueryFromVNPay
      const returnData = vnpParams as unknown as ReturnQueryFromVNPay;
      
      const isValidReturnData = vnpay.verifyReturnUrl(returnData);
      
      if (!isValidReturnData) {
        throw new Error('Invalid payment return data');
      }
      
      const txnRef = vnpParams.vnp_TxnRef;
      const responseCode = vnpParams.vnp_ResponseCode;
      const transactionNo = vnpParams.vnp_TransactionNo;
      const bankCode = vnpParams.vnp_BankCode;
      const paymentTime = vnpParams.vnp_PayDate;
      
      // Xác định trạng thái giao dịch từ response code
      const transactionStatus = responseCode === '00' ? 'success' : 'error';
      
      // Cập nhật thông tin thanh toán trong database
      const { data, error } = await supabase
        .from('vnpay_payments')
        .update({
          transaction_status: transactionStatus,
          payment_time: this.parseVnpayDate(paymentTime),
          bank_code: bankCode,
          transaction_no: transactionNo,
          response_code: responseCode
        })
        .eq('vnp_txn_ref', txnRef)
        .select('order_id');
      
      if (error) throw error;
      
      // Nếu thanh toán thành công, cập nhật trạng thái đơn hàng và di chuyển file
      if (transactionStatus === 'success' && data && data.length > 0) {
        const orderId = data[0].order_id;
        
        // Cập nhật trạng thái thanh toán đơn hàng
        await this.updateOrderPaymentStatus(orderId, 'paid');
        
        // Lấy thông tin order để di chuyển file
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('anonymous_id')
          .eq('id', orderId)
          .single();
        
        if (!orderError && orderData && orderData.anonymous_id) {
          try {
            // Di chuyển file từ thư mục temp sang order
            const { success, newPaths } = await moveFilesFromTempToOrder(orderData.anonymous_id);
            
            if (success && newPaths.length > 0) {
              console.log(`Successfully moved ${newPaths.length} files to order folder for order ${orderId}`);
              
              // Lấy thông tin order_items để cập nhật đường dẫn file
              const { data: orderItems, error: itemsError } = await supabase
                .from('order_items')
                .select('id, custom_design_url, mockup_design_url')
                .eq('order_id', orderId);
              
              if (!itemsError && orderItems) {
                // Cập nhật đường dẫn file trong bảng order_items
                for (const item of orderItems) {
                  if (item.custom_design_url && item.custom_design_url.startsWith('temp/')) {
                    const oldPath = item.custom_design_url;
                    const newPath = `order/${orderData.anonymous_id}/${oldPath.split('/').pop()}`;
                    await updateOrderItemFilePaths(orderId, oldPath, newPath);
                  }
                  
                  if (item.mockup_design_url && item.mockup_design_url.startsWith('temp/')) {
                    const oldPath = item.mockup_design_url;
                    const newPath = `order/${orderData.anonymous_id}/${oldPath.split('/').pop()}`;
                    await updateOrderItemFilePaths(orderId, oldPath, newPath);
                  }
                }
              }
            }
          } catch (fileError) {
            console.error('Error moving files after VNPAY payment:', fileError);
            // Vẫn coi là thanh toán thành công ngay cả khi di chuyển file thất bại
          }
        }
      }
      
      return {
        isSuccess: transactionStatus === 'success',
        txnRef,
        responseCode,
        transactionNo,
        orderId: data?.[0]?.order_id
      };
    } catch (error) {
      console.error('Error verifying payment return:', error);
      throw error;
    }
  },

  /**
   * Cập nhật trạng thái thanh toán đơn hàng
   */
  async updateOrderPaymentStatus(orderId: string, status: string) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: status })
        .eq('id', orderId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error updating order payment status:', error);
      throw error;
    }
  },

  /**
   * Kiểm tra trạng thái giao dịch
   */
  async checkTransactionStatus(orderId: string) {
    try {
      const { data, error } = await supabase
        .from('vnpay_payments')
        .select('*')
        .eq('order_id', orderId)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error checking transaction status:', error);
      throw error;
    }
  },

  /**
   * Parse VNPay date format to JavaScript Date object
   */
  parseVnpayDate(vnpDate?: string): Date | null {
    if (!vnpDate) return null;
    
    try {
      // Format: YYYYMMDDHHMMSS
      const year = parseInt(vnpDate.substring(0, 4));
      const month = parseInt(vnpDate.substring(4, 6)) - 1; // JS months are 0-indexed
      const day = parseInt(vnpDate.substring(6, 8));
      const hour = parseInt(vnpDate.substring(8, 10));
      const minute = parseInt(vnpDate.substring(10, 12));
      const second = parseInt(vnpDate.substring(12, 14));
      
      return new Date(year, month, day, hour, minute, second);
    } catch (error) {
      console.error('Error parsing VNPay date:', error);
      return null;
    }
  },

  /**
   * Xác thực chữ ký từ VNPay (dùng cho IPN callback)
   */
  verifySignature(vnpParams: Record<string, string>): boolean {
    try {
      // Ép kiểu dữ liệu để tương thích với ReturnQueryFromVNPay
      const returnData = vnpParams as unknown as ReturnQueryFromVNPay;
      
      // Sử dụng thư viện vnpay để xác thực chữ ký
      // Chuyển đổi kết quả sang boolean bằng cách ép kiểu
      const result = vnpay.verifyReturnUrl(returnData);
      
      // Chuyển đổi result thành boolean một cách an toàn
      return Boolean(result);
    } catch (error) {
      console.error('Error verifying VNPay signature:', error);
      return false;
    }
  }
};

export default VNPayService; 