import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui';
import { User, Package, LogOut } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  created_at?: string;
}

interface Order {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total: number;
  shipping_address?: string;
  order_items: OrderItem[];
}

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  inventory_item_id?: string;
  order_id?: string;
}

export function Account() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state for profile updates
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/account/login');
      return;
    }
    
    fetchUserProfile();
    fetchOrders();
  }, [user]);

  // Fetch user profile from database
  const fetchUserProfile = async () => {
    try {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
      }
    } catch (error: any) {
      console.error('Error fetching user profile:', error.message);
      setError('Không thể tải thông tin người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user orders based on email
  const fetchOrders = async () => {
    setLoading(true);
    try {
      // If user is logged in, get orders by user_id
      if (profile?.id) {
        const { data: userOrders, error: userOrdersError } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });

        if (userOrdersError) throw userOrdersError;
        
        // If orders found, set them
        if (userOrders && userOrders.length > 0) {
          setOrders(userOrders);
          return;
        }
      }
      
      // If no orders found by user_id, try with email
      const userEmail = user?.email || profile?.email;
      
      if (userEmail) {
        const { data: emailOrders, error: emailOrdersError } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('email', userEmail)
          .order('created_at', { ascending: false });

        if (emailOrdersError) throw emailOrdersError;
        setOrders(emailOrders || []);
      } else {
        // Fallback to empty orders
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle profile update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateMessage(null);
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: fullName,
          phone: phone
        })
        .eq('id', user?.id);
      
      if (error) throw error;
      
      // Update auth metadata
      await supabase.auth.updateUser({
        data: { full_name: fullName, phone: phone }
      });
      
      setUpdateMessage({ type: 'success', text: 'Cập nhật thông tin thành công' });
      setIsEditing(false);
      fetchUserProfile(); // Refresh data
    } catch (error: any) {
      console.error('Error updating profile:', error.message);
      setUpdateMessage({ type: 'error', text: 'Không thể cập nhật thông tin' });
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format status
  const formatStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'Chờ xác nhận';
      case 'processing': return 'Đang xử lý';
      case 'shipping': return 'Đang giao hàng';
      case 'delivered': return 'Đã giao hàng';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Tài khoản của tôi</h1>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-black"
            >
              <LogOut size={18} />
              Đăng xuất
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User size={18} />
                Thông tin cá nhân
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <Package size={18} />
                Đơn hàng của tôi
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile" className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Thông tin cá nhân</h2>
              
              {updateMessage && (
                <div className={`p-3 rounded-lg mb-4 ${
                  updateMessage.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {updateMessage.text}
                </div>
              )}
              
              {isEditing ? (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full p-2 border rounded-lg"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2 border rounded-lg"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      className="w-full p-2 border rounded-lg bg-gray-50"
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Email không thể thay đổi
                    </p>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                    >
                      Lưu thay đổi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setFullName(profile?.full_name || '');
                        setPhone(profile?.phone || '');
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Họ và tên</h3>
                    <p className="text-lg">{profile?.full_name}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Email</h3>
                    <p className="text-lg">{profile?.email}</p>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Số điện thoại</h3>
                    <p className="text-lg">{profile?.phone}</p>
                  </div>
                  
                  <div className="pt-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                    >
                      Chỉnh sửa thông tin
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="orders" className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Đơn hàng của tôi</h2>
              
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <Package size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Bạn chưa có đơn hàng nào</p>
                  <button
                    onClick={() => navigate('/')}
                    className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                  >
                    Mua sắm ngay
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h3 className="font-medium">Đơn hàng #{order.id.substring(0, 8)}</h3>
                          <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                          order.status === 'shipping' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {formatStatus(order.status)}
                        </span>
                      </div>
                      
                      <div className="border-t border-b py-3 space-y-2">
                        {order.order_items.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <div className="flex gap-2">
                              <span className="text-gray-800">
                                Sản phẩm #{item.inventory_item_id ? item.inventory_item_id.substring(0, 6) : ''}
                              </span>
                              <span className="text-gray-500">
                                x{item.quantity}
                              </span>
                            </div>
                            <span className="font-medium">
                              ${item.price.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-between items-center pt-3">
                        <div className="text-sm">
                          <span className="text-gray-500">
                            {order.payment_method === 'cod' ? 'Thanh toán khi nhận hàng' : 'Thanh toán qua VNPAY'}
                          </span>
                          <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                            order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.payment_status === 'paid' ? 'Đã thanh toán' : 'Chờ thanh toán'}
                          </span>
                        </div>
                        <div className="font-semibold">
                          Tổng: ${order.total.toFixed(2)}
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <button
                          onClick={() => navigate(`/order-confirmation/${order.id}`)}
                          className="text-sm text-black hover:underline"
                        >
                          Xem chi tiết đơn hàng
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
} 