import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import GHNService from '../lib/ghnService';
import { OrderDetail } from '../types/Order';
import { increaseInventoryOnOrderCancellation } from '../lib/inventoryManager';

interface OrderHistoryProps {
  userId?: string;
}

export default function OrderHistory({ userId }: OrderHistoryProps) {
  const [orders, setOrders] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  
  useEffect(() => {
    if (userId) {
      fetchUserOrders(userId);
    }
  }, [userId]);
  
  async function fetchUserOrders(userId: string) {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('order_details')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  async function cancelOrder(orderId: string) {
    try {
      // Find the order
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        setError('Order not found');
        return;
      }
      
      // Only allow cancellation if the order is in pending status
      if (order.status !== 'pending') {
        setError('Only pending orders can be cancelled');
        return;
      }
      
      // Check if the order has a GHN shipping order
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('has_ghn_order, ghn_code')
        .eq('id', orderId)
        .single();
      
      if (queryError) throw queryError;
      
      // Prevent cancellation if GHN order exists
      if (data.has_ghn_order) {
        setError('This order cannot be cancelled because shipping has been arranged');
        return;
      }
      
      // Update order status to cancelled
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      
      if (error) throw error;
      
      // Restore inventory quantities
      try {
        const inventoryResult = await increaseInventoryOnOrderCancellation(orderId);
        if (inventoryResult.success) {
          console.log('Inventory restored successfully:', inventoryResult.message);
        } else {
          console.error('Failed to restore inventory:', inventoryResult.message);
        }
      } catch (inventoryError: any) {
        console.error('Error restoring inventory:', inventoryError.message);
      }
      
      // Refresh orders
      if (userId) {
        await fetchUserOrders(userId);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }
  
  // Filter orders based on status filter
  const filteredOrders = orders.filter(order => 
    statusFilter === 'all' || order.status === statusFilter
  );
  
  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-2xl font-bold mb-2 md:mb-0">Your Orders</h2>
        <div className="flex items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 border border-gray-300 rounded-md"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipping">Shipping</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="returned">Returned</option>
          </select>
        </div>
      </div>
      
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
      
      {loading ? (
        <div className="text-center py-4">Loading your orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">You don't have any orders yet</p>
          <Link to="/shop" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div key={order.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                  <div className="text-sm text-gray-500">Order ID: <span className="font-medium text-gray-900">{order.id.substring(0, 8)}</span></div>
                  <div className="text-sm text-gray-500">Placed on: <span className="font-medium">{new Date(order.created_at).toLocaleDateString()}</span></div>
                </div>
                <div className="mt-2 md:mt-0 flex flex-col items-start md:items-end">
                  <div className="flex items-center">
                    <span className="mr-2 text-sm text-gray-500">Status:</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'processing' || order.status === 'shipping' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center mt-1">
                    <span className="mr-2 text-sm text-gray-500">Payment:</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                      order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-4 border-t border-gray-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Total: ${order.total.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">
                      Subtotal: ${order.subtotal.toFixed(2)} | Shipping: ${order.shipping_fee.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Payment Method: {order.payment_method === 'cod' ? 'Cash on Delivery' : 'VNPAY'}
                    </div>
                  </div>
                  
                  <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end space-y-2">
                    <Link 
                      to={`/account/orders/${order.id}`} 
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                    >
                      View Details
                    </Link>
                    
                    {order.status === 'pending' && (
                      <button 
                        onClick={() => cancelOrder(order.id)} 
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Cancel Order
                      </button>
                    )}
                    
                    {order.tracking_url && (
                      <a 
                        href={order.tracking_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        Track Shipment
                      </a>
                    )}
                  </div>
                </div>
              </div>
              
              {order.shipping_status && (
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <div className="text-sm font-medium">Shipping Status</div>
                  <div className="mt-2">
                    <div className="flex items-center">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        order.shipping_status === 'delivered' ? 'bg-green-500' :
                        order.shipping_status === 'delivering' ? 'bg-blue-500' :
                        order.shipping_status === 'cancelled' ? 'bg-red-500' :
                        'bg-yellow-500'
                      } mr-2`}></span>
                      <span className="text-sm text-gray-500">
                        {order.shipping_status.charAt(0).toUpperCase() + order.shipping_status.slice(1)}
                        {order.shipping_status === 'delivering' && (
                          <>
                            <span className="mx-1">•</span>
                            <span className="font-medium">
                              Est. Delivery: {order.expected_delivery_time ? new Date(order.expected_delivery_time).toLocaleDateString() : 'Unknown'}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 