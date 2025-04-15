import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface OrderDetail {
  id: string;
  full_name: string;
  shipping_address: string;
  phone_number: string;
  email?: string;
  payment_method: string;
  payment_status: string;
  shipping_fee: number;
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
}

interface OrderItem {
  id: string;
  custom_design_url?: string;
  mockup_design_url?: string;
  quantity: number;
  price: number;
  product_name?: string;
}

export function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const { user } = useAuth();

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  // Load public URLs for stored images when order items change
  useEffect(() => {
    loadImageUrls();
  }, [orderItems]);

  async function loadImageUrls() {
    if (orderItems.length === 0) return;
    
    const urlMap: Record<string, string> = {};
    
    for (const item of orderItems) {
      // Process mockup_design_url paths
      if (item.mockup_design_url) {
        try {
          const { data } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.mockup_design_url);
          
          if (data.publicUrl) {
            urlMap[item.mockup_design_url] = data.publicUrl;
          }
        } catch (error) {
          console.error('Error getting public URL for mockup design:', error);
        }
      }
      
      // Process custom_design_url paths
      if (item.custom_design_url) {
        try {
          const { data } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.custom_design_url);
          
          if (data.publicUrl) {
            urlMap[item.custom_design_url] = data.publicUrl;
          }
        } catch (error) {
          console.error('Error getting public URL for custom design:', error);
        }
      }
    }
    
    setImageUrls(urlMap);
  }

  // Helper function to get the correct image URL
  const getImageUrl = (path: string | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    if (path.startsWith('data:')) return path;
    
    // Use the url from imageUrls if available
    if (imageUrls[path]) return imageUrls[path];
    
    // Return a placeholder if image not found
    return undefined;
  };

  async function fetchOrderDetails() {
    try {
      setLoading(true);
      
      if (!orderId) {
        setError('Không tìm thấy mã đơn hàng');
        return;
      }

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) {
        throw orderError;
      }

      setOrder(orderData as OrderDetail);

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (itemsError) {
        throw itemsError;
      }

      setOrderItems(itemsData as OrderItem[]);
    } catch (error: any) {
      console.error('Error fetching order details:', error);
      setError(error.message || 'Có lỗi xảy ra khi lấy thông tin đơn hàng');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải thông tin đơn hàng...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Không thể tìm thấy đơn hàng</h1>
          <p className="text-gray-600 mb-6">{error || 'Đơn hàng không tồn tại hoặc đã bị xóa'}</p>
          <Link to="/" className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            Quay về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-sm">
            <div className="text-center mb-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h1 className="text-3xl font-bold mt-4">Đặt hàng thành công!</h1>
              <p className="text-gray-600 mt-2">
                Cảm ơn bạn đã đặt hàng. Đơn hàng của bạn đã được xác nhận.
              </p>
            </div>

            {/* Hiển thị thông báo đăng ký nếu chưa đăng nhập */}
            {!user && order && order.email && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <UserPlus className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Tạo tài khoản để dễ dàng theo dõi đơn hàng
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Đăng ký tài khoản để xem lịch sử đơn hàng của bạn trên mọi thiết bị.
                        Email của bạn {order.email} sẽ được sử dụng để đăng ký.
                      </p>
                    </div>
                    <div className="mt-3">
                      <Link
                        to="/account/register"
                        className="inline-flex items-center gap-1 px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <UserPlus className="h-4 w-4" />
                        Đăng ký tài khoản
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-b py-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold">Mã đơn hàng: #{orderId?.slice(0, 8) || ''}</h2>
                  <p className="text-gray-600 text-sm">
                    Đặt lúc: {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="px-4 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm uppercase font-medium">
                  {order.status === 'pending' ? 'Chờ xác nhận' : 
                   order.status === 'processing' ? 'Đang xử lý' : 
                   order.status === 'shipping' ? 'Đang giao hàng' : 
                   order.status === 'delivered' ? 'Đã giao hàng' : 
                   order.status === 'cancelled' ? 'Đã hủy' : order.status}
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3">Thông tin đơn hàng</h3>
              
              <div className="space-y-2 text-gray-600">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 font-medium">Họ tên người nhận:</div>
                  <div className="col-span-2">{order.full_name}</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 font-medium">Số điện thoại:</div>
                  <div className="col-span-2">{order.phone_number}</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 font-medium">Địa chỉ giao hàng:</div>
                  <div className="col-span-2">{order.shipping_address}</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 font-medium">Phương thức thanh toán:</div>
                  <div className="col-span-2">
                    {order.payment_method === 'cod' ? 'Thanh toán khi nhận hàng (COD)' : 'Thanh toán qua VNPAY'}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1 font-medium">Trạng thái thanh toán:</div>
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 
                      order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.payment_status === 'paid' ? 'Đã thanh toán' : 
                       order.payment_status === 'pending' ? 'Chờ thanh toán' : 
                       order.payment_status === 'cancelled' ? 'Đã hủy' : 
                       'Hoàn tiền'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3">Chi tiết sản phẩm</h3>
              
              <div className="border rounded-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sản phẩm
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Số lượng
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Giá
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Thành tiền
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orderItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-16 w-16 mr-4">
                              {item.mockup_design_url ? (
                                <img 
                                  src={getImageUrl(item.mockup_design_url)} 
                                  alt="Product mockup" 
                                  className="h-16 w-16 object-contain rounded"
                                />
                              ) : item.custom_design_url ? (
                                <img 
                                  src={getImageUrl(item.custom_design_url)} 
                                  alt="Custom design" 
                                  className="h-16 w-16 object-contain rounded"
                                />
                              ) : (
                                <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                                  No image
                                </div>
                              )}
                            </div>
                            <div>
                              {item.product_name || (item.custom_design_url ? 'Thiết kế tùy chỉnh' : 'Sản phẩm')}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-500">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-500">
                          ${item.price.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          ${(item.price * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                        Tạm tính
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium">
                        ${order.subtotal.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right text-sm font-medium text-gray-500">
                        Phí vận chuyển
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-medium">
                        ${order.shipping_fee.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                        Tổng cộng
                      </td>
                      <td className="px-6 py-3 text-right text-lg font-bold">
                        ${order.total.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="text-center">
              <Link to="/" className="px-6 py-3 bg-indigo-600 text-white rounded-md inline-block hover:bg-indigo-700">
                Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 