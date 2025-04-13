import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PackageSearch, Truck, Check, ArrowLeft, Clock, Calendar, DollarSign } from 'lucide-react';

interface OrderDetail {
  id: string;
  status: string;
  payment_method: string;
  payment_status: string;
  shipping_fee: number;
  subtotal: number;
  total: number;
  created_at: string;
  shipping_status?: string;
  ghn_order_code?: string;
  tracking_url?: string;
  expected_delivery_time?: string;
  updated_at: string;
  customer_name: string;
  email: string;
  phone: string;
  address: string;
  items?: OrderItem[];
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  image_url?: string;
  custom_design?: boolean;
  phone_model?: string;
  case_type?: string;
}

export function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!orderId) return;
    
    async function fetchOrderDetails() {
      try {
        setLoading(true);
        
        // Fetch order details
        const { data: orderData, error: orderError } = await supabase
          .from('order_details')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (orderError) throw orderError;
        
        if (!orderData) {
          setError('Order not found');
          return;
        }
        
        setOrder(orderData);
        
        // Fetch order items
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId);
        
        if (itemsError) throw itemsError;
        setOrderItems(itemsData || []);
        
      } catch (err: any) {
        console.error('Error fetching order:', err);
        setError(err.message || 'Failed to load order details');
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrderDetails();
  }, [orderId]);

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status step (0-3)
  const getStatusStep = () => {
    if (!order) return 0;
    
    switch (order.status) {
      case 'pending':
        return 0;
      case 'processing':
        return 1; 
      case 'shipping':
        return 2;
      case 'delivered':
        return 3;
      default:
        return 0;
    }
  };

  if (loading) {
    return (
      <div className="pt-28 min-h-screen bg-gray-50 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="pt-28 min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
            <p className="text-gray-600 mb-6">{error || 'Order not found'}</p>
            <Link 
              to="/"
              className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusStep = getStatusStep();

  return (
    <div className="pt-28 min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Order Tracking</h1>
            <span className="text-sm text-gray-500">Order #{order.id.substring(0, 8)}</span>
          </div>
          
          {/* Order Status Progress */}
          <div className="mb-10">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="h-1 w-full bg-gray-200 relative">
                  <div 
                    className="h-1 bg-green-500 absolute top-0 left-0 transition-all duration-500" 
                    style={{ width: `${(statusStep / 3) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="relative flex justify-between">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    statusStep >= 0 ? 'bg-green-500 text-white' : 'bg-gray-200'
                  }`}>
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="text-xs mt-2">Pending</div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    statusStep >= 1 ? 'bg-green-500 text-white' : 'bg-gray-200'
                  }`}>
                    <PackageSearch className="h-4 w-4" />
                  </div>
                  <div className="text-xs mt-2">Processing</div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    statusStep >= 2 ? 'bg-green-500 text-white' : 'bg-gray-200'
                  }`}>
                    <Truck className="h-4 w-4" />
                  </div>
                  <div className="text-xs mt-2">Shipping</div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    statusStep >= 3 ? 'bg-green-500 text-white' : 'bg-gray-200'
                  }`}>
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="text-xs mt-2">Delivered</div>
                </div>
              </div>
            </div>
            
            {/* Current status description */}
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium mb-2">Current Status: <span className="font-bold capitalize">{order.status}</span></h3>
              <p className="text-sm text-gray-600">
                {order.status === 'pending' && 'Your order has been received and is awaiting processing.'}
                {order.status === 'processing' && 'Your order is currently being processed and prepared for shipment.'}
                {order.status === 'shipping' && 'Your order has been shipped and is on its way to you.'}
                {order.status === 'delivered' && 'Your order has been delivered. Thank you for shopping with us!'}
                {order.status === 'cancelled' && 'Your order has been cancelled.'}
              </p>
              
              {order.shipping_status && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Shipping Status: </span>
                  <span className="capitalize">{order.shipping_status}</span>
                </div>
              )}
              
              {order.expected_delivery_time && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Expected Delivery: </span>
                  {new Date(order.expected_delivery_time).toLocaleDateString()}
                </div>
              )}
              
              {order.ghn_order_code && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Tracking Code: </span>
                  {order.ghn_order_code}
                </div>
              )}
              
              {order.tracking_url && (
                <a 
                  href={order.tracking_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                >
                  <Truck className="mr-1 h-4 w-4" />
                  Track your shipment
                </a>
              )}
            </div>
          </div>
          
          {/* Order Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="text-lg font-medium mb-3 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-gray-500" />
                Order Information
              </h3>
              <div className="text-sm space-y-2">
                <p><span className="font-medium">Order Date:</span> {formatDate(order.created_at)}</p>
                <p><span className="font-medium">Customer:</span> {order.customer_name}</p>
                <p><span className="font-medium">Email:</span> {order.email}</p>
                <p><span className="font-medium">Phone:</span> {order.phone}</p>
                <p><span className="font-medium">Address:</span> {order.address}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-3 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-gray-500" />
                Payment Information
              </h3>
              <div className="text-sm space-y-2">
                <p>
                  <span className="font-medium">Payment Method:</span> 
                  {order.payment_method === 'cod' ? 'Cash on Delivery' : 'VNPAY'}
                </p>
                <p>
                  <span className="font-medium">Payment Status:</span> 
                  <span className={`ml-1 ${
                    order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </p>
                <p><span className="font-medium">Subtotal:</span> ${order.subtotal.toFixed(2)}</p>
                <p><span className="font-medium">Shipping Fee:</span> ${order.shipping_fee.toFixed(2)}</p>
                <p className="font-bold"><span>Total:</span> ${order.total.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          {/* Order Items */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3">Order Items</h3>
            <div className="border rounded-md overflow-hidden">
              {orderItems.length > 0 ? (
                <div className="divide-y">
                  {orderItems.map((item) => (
                    <div key={item.id} className="p-4 flex items-center">
                      <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden mr-4">
                        {item.image_url ? (
                          <img 
                            src={item.image_url} 
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No image
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{item.product_name}</h4>
                        <div className="text-sm text-gray-600 mt-1">
                          {item.custom_design ? 'Custom Design' : ''} 
                          {item.phone_model && ` • ${item.phone_model}`}
                          {item.case_type && ` • ${item.case_type}`}
                        </div>
                        <div className="mt-2 flex justify-between">
                          <span className="text-sm">{item.quantity} × ${item.price.toFixed(2)}</span>
                          <span className="font-medium">${(item.quantity * item.price).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">No items found</div>
              )}
            </div>
          </div>
          
          {/* Back button */}
          <div className="mt-8">
            <Link 
              to="/"
              className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 