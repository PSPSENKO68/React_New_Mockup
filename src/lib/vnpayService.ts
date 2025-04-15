import { supabase } from './supabase';
import { moveFilesFromTempToOrder, updateOrderItemFilePaths } from '../utils/fileStorage';

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
 * Service tương tác với VNPAY API
 */
export const VNPayService = {
  /**
   * Tạo URL thanh toán
   */
  async createPaymentUrl(params: CreatePaymentParams) {
    try {
      // Call the server API endpoint instead of calculating locally
      const response = await fetch('/api/payment/vnpay/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create payment URL: ${error}`);
      }
      
      return await response.json();
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
      // Call the server API endpoint instead of verifying locally
      const response = await fetch('/api/payment/vnpay/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(vnpParams),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to verify payment: ${error}`);
      }
      
      return await response.json();
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
  async verifySignature(vnpParams: Record<string, string>): Promise<boolean> {
    try {
      // Call the server API for verification instead
      const result = await this.verifyPaymentReturn(vnpParams);
      return result.isSuccess;
    } catch (error) {
      console.error('Error in verifySignature:', error);
      return false;
    }
  }
};

export default VNPayService; 