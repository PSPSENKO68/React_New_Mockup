import { useState, useEffect } from 'react';
import VNPayService from '../lib/vnpayService';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface VNPayCheckoutProps {
  orderId?: string;
  onPaymentCreated?: (url: string) => void;
  onError?: (error: Error) => void;
}

export default function VNPayCheckout({ 
  orderId,
  onPaymentCreated,
  onError
}: VNPayCheckoutProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    createVNPayPayment();
  }, [orderId]);

  const createVNPayPayment = async () => {
    if (!orderId) {
      setError('Order ID is required');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get order details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, total, payment_status')
        .eq('id', orderId)
        .single();
      
      if (orderError) {
        // Check if the error is related to order_history table
        if (orderError.message && orderError.message.includes('order_history')) {
          console.warn('Order history table error, but continuing with checkout:', orderError.message);
          // Continue with the process despite the error
        } else {
          throw orderError;
        }
      }
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      // If order already has a payment, check its status
      const { data: existingPayment } = await supabase
        .from('vnpay_payments')
        .select('vnp_txn_ref, transaction_status, amount')
        .eq('order_id', orderId)
        .maybeSingle();
      
      // If there's an existing successful payment, don't create a new one
      if (existingPayment && existingPayment.transaction_status === 'success') {
        setError('Order has already been paid. Redirecting...');
        setTimeout(() => {
          window.location.href = `/order-confirmation/${orderId}`;
        }, 3000);
        return;
      }
      
      // Create a unique transaction reference
      const txnRef = existingPayment?.vnp_txn_ref || `${orderId.substring(0, 8)}-${Date.now()}`;
      
      // If no existing payment, create one
      if (!existingPayment) {
        await supabase
          .from('vnpay_payments')
          .insert({
            order_id: orderId,
            vnp_txn_ref: txnRef,
            amount: order.total,
            transaction_status: 'pending'
          });
      }
      
      // Call Supabase Edge Function to create VNPay payment URL
      const { data, error: fnError } = await supabase.functions.invoke('create-vnpay-payment', {
        body: {
          amount: order.total,
          orderId: orderId,
          txnRef: txnRef
        }
      });
      
      if (fnError) {
        throw fnError;
      }
      
      if (!data || !data.paymentUrl) {
        throw new Error('Failed to generate payment URL');
      }
      
      // Callback with the payment URL
      if (onPaymentCreated) {
        onPaymentCreated(data.paymentUrl);
      } else {
        // Open payment URL in new window
        window.open(data.paymentUrl, '_blank');
      }
    } catch (err: any) {
      // If error is related to order_history, ignore it and proceed
      if (err.message && err.message.includes('order_history')) {
        console.warn('Ignoring error related to order_history:', err.message);
        
        // Try to get any available payment URL
        try {
          const { data } = await supabase.functions.invoke('create-vnpay-payment', {
            body: {
              orderId: orderId,
              txnRef: `${orderId.substring(0, 8)}-${Date.now()}`,
              amount: 0  // Will be fetched from the order inside the function
            }
          });
          
          if (data && data.paymentUrl) {
            if (onPaymentCreated) {
              onPaymentCreated(data.paymentUrl);
            } else {
              // Open payment URL in new window
              window.open(data.paymentUrl, '_blank');
            }
            return;
          }
        } catch (innerError) {
          console.error('Failed to recover from order_history error:', innerError);
        }
      }
      
      console.error('Error creating VNPay payment:', err);
      setError(err.message || 'An error occurred while setting up payment');
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Đang chuẩn bị thanh toán</h2>
            <p className="text-gray-600 text-center">Vui lòng đợi trong giây lát, chúng tôi đang kết nối đến cổng thanh toán VNPay...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="bg-red-100 text-red-700 p-3 rounded-full mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">Lỗi thanh toán</h2>
            <p className="text-gray-600 text-center mb-4">{error}</p>
            <button 
              onClick={() => window.location.href = `/order-confirmation/${orderId}`}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Component for handling the VNPAY return URL
export function VNPayReturn() {
  const [status, setStatus] = useState<'success' | 'failed' | 'processing'>('processing');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  
  useEffect(() => {
    // Parse query parameters
    const vnpParams: Record<string, string> = {};
    params.forEach((value, key) => {
      vnpParams[key] = value;
    });
    
    // Verify payment
    verifyPayment(vnpParams);
  }, []);
  
  async function verifyPayment(vnpParams: Record<string, string>) {
    try {
      // Call verify payment function
      const result = await VNPayService.verifyPaymentReturn(vnpParams);
      
      if (result.isSuccess) {
        setStatus('success');
      } else {
        setStatus('failed');
      }
      
      if (result.orderId) {
        setOrderId(result.orderId);
      }
    } catch (err: any) {
      setStatus('failed');
      setError(err.message);
    }
  }
  
  function goToOrder() {
    if (orderId) {
      navigate(`/account/orders/${orderId}`);
    } else {
      navigate('/account/orders');
    }
  }
  
  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md mt-10">
      {status === 'processing' ? (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg">Processing your payment...</p>
        </div>
      ) : status === 'success' ? (
        <div className="text-center">
          <div className="rounded-full h-16 w-16 bg-green-100 flex items-center justify-center mx-auto">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Payment Successful!</h2>
          <p className="mt-2 text-gray-600">Thank you for your payment. Your order is being processed.</p>
          <button
            onClick={goToOrder}
            className="mt-6 w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
          >
            View Order Details
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="rounded-full h-16 w-16 bg-red-100 flex items-center justify-center mx-auto">
            <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Payment Failed</h2>
          <p className="mt-2 text-gray-600">
            {error || "We couldn't process your payment. Please try again."}
          </p>
          <button
            onClick={goToOrder}
            className="mt-6 w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
          >
            View Order
          </button>
        </div>
      )}
    </div>
  );
} 