import { useState, useEffect } from 'react';
import VNPayService from '../lib/vnpayService';
import { useNavigate } from 'react-router-dom';

interface VNPayCheckoutProps {
  orderId?: string;
  amount: number;
  orderInfo: string;
  onPaymentCreated?: (url: string) => void;
  onError?: (error: Error) => void;
}

export default function VNPayCheckout({ 
  orderId,
  amount,
  orderInfo,
  onPaymentCreated,
  onError
}: VNPayCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  async function initiatePayment() {
    if (!orderId) {
      setError('Order ID is required');
      return;
    }
    
    try {
      setLoading(true);
      
      // Get client IP (in real environment, this would be handled by the server)
      const clientIp = '127.0.0.1';
      
      // Create payment URL
      const { paymentUrl } = VNPayService.createPaymentUrl({
        orderId,
        amount,
        orderInfo,
        clientIp
      });
      
      // Call onPaymentCreated callback or redirect
      if (onPaymentCreated) {
        onPaymentCreated(paymentUrl);
      } else {
        // Open payment URL in new window
        window.open(paymentUrl, '_blank');
      }
    } catch (err: any) {
      setError(err.message);
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div>
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
          {error}
          <button 
            onClick={() => setError(null)} 
            className="ml-2 text-sm underline"
          >
            Dismiss
          </button>
        </div>
      )}
      
      <button
        onClick={initiatePayment}
        disabled={loading}
        className={`w-full py-3 px-4 flex items-center justify-center rounded-md ${
          loading 
            ? 'bg-gray-300 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {loading ? (
          <span>Processing...</span>
        ) : (
          <>
            <img 
              src="/vnpay-logo.png" 
              alt="VNPAY" 
              className="h-6 mr-2" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            Pay with VNPAY
          </>
        )}
      </button>
    </div>
  );
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