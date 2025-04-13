import { supabase } from './supabase';
import { moveFilesFromTempToOrder, updateOrderItemFilePaths } from '../utils/fileStorage';
import crypto from 'crypto';

// Polyfill for createHmac compatibility with Node.js v22
// This prevents the "_y.createHmac is not a function" error
const originalCreateHmac = crypto.createHmac;
crypto.createHmac = function(algorithm, key) {
  try {
    return originalCreateHmac(algorithm, key);
  } catch (error) {
    console.error('Error in createHmac:', error);
    // Fallback implementation if needed
    return originalCreateHmac(algorithm, key);
  }
};

// We're no longer using the VNPay class directly
// Instead we use our custom implementation for all VNPay operations

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  orderInfo: string;
  clientIp: string;
  locale?: string;
}

// Type definitions that were previously imported from vnpay
export type VnpLocale = 'vn' | 'en';

/**
 * Hàm tạo chữ ký HMAC bằng sha512
 */
function createSecureHash(data: string, secureSecret: string): string {
  try {
    const hmac = crypto.createHmac('sha512', secureSecret);
    const signed = hmac.update(Buffer.from(data, 'utf-8')).digest('hex');
    return signed;
  } catch (error) {
    console.error('Error creating secure hash:', error);
    throw error;
  }
}

/**
 * Sắp xếp tham số theo thứ tự alphabet của key
 */
function sortObject(obj: Record<string, any>): Record<string, string> {
  const sorted: Record<string, string> = {};
  const str: string[] = [];
  
  // Push all keys to an array
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      str.push(encodeURIComponent(key));
    }
  });
  
  // Sort the keys
  str.sort();
  
  // Create new object with sorted keys
  str.forEach(key => {
    sorted[key] = encodeURIComponent(obj[decodeURIComponent(key)]).replace(/%20/g, "+");
  });
  
  return sorted;
}

/**
 * Xác thực chữ ký từ VNPay
 */
function verifyVnpaySignature(vnpParams: Record<string, string>, secureSecret: string): boolean {
  try {
    // Lấy chữ ký từ tham số
    const secureHash = vnpParams['vnp_SecureHash'];
    
    if (!secureHash) {
      return false;
    }
    
    // Tạo một bản sao của params và loại bỏ vnp_SecureHash
    const params = { ...vnpParams };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];
    
    // Sắp xếp các tham số
    const sortedParams = sortObject(params);
    
    // Chuyển thành chuỗi query để tạo chữ ký
    const queryString = Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    // Tạo chữ ký
    const hmac = crypto.createHmac('sha512', secureSecret);
    const signed = hmac.update(Buffer.from(queryString, 'utf-8')).digest('hex');
    
    // So sánh chữ ký
    return secureHash === signed;
  } catch (error) {
    console.error('Error verifying VNPay signature:', error);
    return false;
  }
}

/**
 * Tạo URL thanh toán VNPAY
 */
function buildVnpayUrl(params: Record<string, any>, secureSecret: string, vnpayHost: string): string {
  try {
    // Format ngày giờ theo yêu cầu của VNPAY
    const createDate = new Date();
    const createDateFormat = createDate.getFullYear().toString() +
      (createDate.getMonth() + 1).toString().padStart(2, '0') +
      createDate.getDate().toString().padStart(2, '0') +
      createDate.getHours().toString().padStart(2, '0') +
      createDate.getMinutes().toString().padStart(2, '0') +
      createDate.getSeconds().toString().padStart(2, '0');
    
    // Chuẩn bị các tham số cơ bản
    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: params.vnp_TmnCode || '',
      vnp_Locale: params.vnp_Locale || 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.vnp_TxnRef || '',
      vnp_OrderInfo: params.vnp_OrderInfo || '',
      vnp_OrderType: params.vnp_OrderType || 'other',
      vnp_Amount: params.vnp_Amount?.toString() || '0',
      vnp_ReturnUrl: params.vnp_ReturnUrl || '',
      vnp_IpAddr: params.vnp_IpAddr || '127.0.0.1',
      vnp_CreateDate: createDateFormat,
    };
    
    // Thêm các tham số tùy chọn
    if (params.vnp_BankCode) {
      vnpParams.vnp_BankCode = params.vnp_BankCode;
    }
    
    // Sắp xếp tham số
    const sortedParams = sortObject(vnpParams);
    
    // Chuyển thành chuỗi query để tạo chữ ký
    const queryString = Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    // Tạo chữ ký
    const signed = createSecureHash(queryString, secureSecret);
    
    // Thêm chữ ký vào params
    const paramsWithHash = { ...sortedParams, vnp_SecureHash: signed };
    
    // Tạo URL đầy đủ
    const finalQueryString = Object.entries(paramsWithHash)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    return `${vnpayHost}?${finalQueryString}`;
  } catch (error) {
    console.error('Error building VNPAY URL:', error);
    throw error;
  }
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
      
      // Chuẩn bị tham số cho VNPAY
      const vnpParams = {
        vnp_TmnCode: import.meta.env.VITE_VNPAY_TMN_CODE || '',
        vnp_Amount: params.amount * 100, // VNPAY yêu cầu số tiền * 100
        vnp_IpAddr: params.clientIp,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: params.orderInfo,
        vnp_OrderType: 'other',
        vnp_Locale: params.locale || 'vn',
        vnp_ReturnUrl: import.meta.env.VITE_VNPAY_RETURN_URL,
      };
      
      // Tạo URL thanh toán
      const paymentUrl = buildVnpayUrl(
        vnpParams,
        import.meta.env.VITE_VNPAY_HASH_SECRET || '',
        import.meta.env.VITE_VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
      );
      
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
      // Xác thực chữ ký
      const isValidReturnData = verifyVnpaySignature(
        vnpParams, 
        import.meta.env.VITE_VNPAY_HASH_SECRET || ''
      );
      
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
      return verifyVnpaySignature(
        vnpParams, 
        import.meta.env.VITE_VNPAY_HASH_SECRET || ''
      );
    } catch (error) {
      console.error('Error verifying VNPay signature:', error);
      return false;
    }
  }
};

export default VNPayService; 