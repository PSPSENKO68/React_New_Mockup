import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui';
import { User, Package, LogOut, Lock, Check, AlertCircle, Search, X, Calendar, ShoppingBag } from 'lucide-react';

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
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state for profile updates
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // State for password change
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdateMessage, setPasswordUpdateMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // State for canceling orders
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelOrderMessage, setCancelOrderMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // State for order search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchStatus, setSearchStatus] = useState<string>('');

  useEffect(() => {
    if (!user) {
      navigate('/account/login');
      return;
    }
    
    fetchUserProfile();
    fetchOrders();
  }, [user]);

  // Apply filters whenever orders, searchTerm or searchStatus changes
  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, searchStatus]);

  // Filter orders based on search criteria
  const filterOrders = () => {
    let results = [...orders];
    
    // Filter by search term (id or items)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      results = results.filter(order => 
        order.id.toLowerCase().includes(term) ||
        order.order_items.some(item => 
          item.inventory_item_id?.toLowerCase().includes(term)
        )
      );
    }
    
    // Filter by status
    if (searchStatus) {
      results = results.filter(order => order.status === searchStatus);
    }
    
    setFilteredOrders(results);
  };

  // Clear search filters
  const clearFilters = () => {
    setSearchTerm('');
    setSearchStatus('');
  };

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

  // Handle password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordUpdateMessage(null);
    setPasswordLoading(true);
    
    try {
      // Validate passwords
      if (newPassword.length < 6) {
        throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
      }
      
      if (newPassword !== confirmPassword) {
        throw new Error('Mật khẩu mới và xác nhận mật khẩu không khớp');
      }
      
      // First verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword
      });
      
      if (signInError) {
        throw new Error('Mật khẩu hiện tại không chính xác');
      }
      
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      setPasswordUpdateMessage({ type: 'success', text: 'Đổi mật khẩu thành công' });
      
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (error: any) {
      console.error('Error changing password:', error.message);
      setPasswordUpdateMessage({ type: 'error', text: error.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle order cancellation
  const handleCancelOrder = async (orderId: string) => {
    setIsCancelling(true);
    setCancellingOrderId(orderId);
    setCancelOrderMessage(null);
    
    try {
      // Update order status to 'cancelled'
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
      
      if (error) throw error;
      
      setCancelOrderMessage({ 
        type: 'success', 
        text: 'Đơn hàng đã được hủy thành công' 
      });
      
      // Refresh orders list
      await fetchOrders();
      
      // Auto close message after 3 seconds
      setTimeout(() => {
        setCancelOrderMessage(null);
        setIsCancelling(false);
        setCancellingOrderId(null);
      }, 3000);
      
    } catch (error: any) {
      console.error('Error cancelling order:', error);
      setCancelOrderMessage({ 
        type: 'error', 
        text: 'Không thể hủy đơn hàng. Vui lòng thử lại sau.' 
      });
      setIsCancelling(false);
    }
  };

  // Check if order can be cancelled
  // Only allow cancellation for pending or processing orders
  const canCancelOrder = (status: string) => {
    return ['pending', 'processing'].includes(status);
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
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{profile?.email || user?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Họ và tên</p>
                    <p className="font-medium">{profile?.full_name || 'Chưa cập nhật'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Số điện thoại</p>
                    <p className="font-medium">{profile?.phone || 'Chưa cập nhật'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tài khoản tạo lúc</p>
                    <p className="font-medium">{profile?.created_at ? formatDate(profile.created_at) : 'N/A'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800"
                    >
                      <User size={16} />
                      Cập nhật thông tin
                    </button>
                    
                    <button
                      onClick={() => setIsChangingPassword(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Lock size={16} />
                      Đổi mật khẩu
                    </button>
                  </div>
                </div>
              )}
              
              {/* Password change form */}
              {isChangingPassword && (
                <div className="mt-8 border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Đổi mật khẩu</h3>
                  
                  {passwordUpdateMessage && (
                    <div className={`p-3 rounded-lg mb-4 ${
                      passwordUpdateMessage.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      <div className="flex items-start">
                        {passwordUpdateMessage.type === 'success' ? 
                          <Check className="h-5 w-5 mr-2 flex-shrink-0" /> : 
                          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                        }
                        <p>{passwordUpdateMessage.text}</p>
                      </div>
                    </div>
                  )}
                  
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mật khẩu hiện tại
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mật khẩu mới
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Xác nhận mật khẩu mới
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                      />
                    </div>
                    
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {passwordLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Đang cập nhật...
                          </>
                        ) : (
                          <>
                            <Lock size={16} />
                            Cập nhật mật khẩu
                          </>
                        )}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setIsChangingPassword(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                          setPasswordUpdateMessage(null);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Hủy
                      </button>
                    </div>
                    
                    <div className="text-sm text-gray-500 mt-4">
                      <p>Quên mật khẩu hiện tại? <Link to="/account/forgot-password" className="text-black font-medium hover:underline">Đặt lại mật khẩu</Link></p>
                    </div>
                  </form>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="orders" className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4">Đơn hàng của tôi</h2>
              
              {/* Cancel order message */}
              {cancelOrderMessage && (
                <div className={`p-3 rounded-lg mb-4 ${
                  cancelOrderMessage.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  <div className="flex items-start">
                    {cancelOrderMessage.type === 'success' ? 
                      <Check className="h-5 w-5 mr-2 flex-shrink-0" /> : 
                      <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                    }
                    <p>{cancelOrderMessage.text}</p>
                  </div>
                </div>
              )}
              
              {/* Order search and filter */}
              {orders.length > 0 && (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Search input */}
                    <div className="flex-1">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                          <Search className="w-5 h-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Tìm kiếm theo mã đơn hàng hoặc sản phẩm"
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                        />
                        {searchTerm && (
                          <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Status filter */}
                    <div className="w-full md:w-48">
                      <select
                        value={searchStatus}
                        onChange={(e) => setSearchStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="pending">Chờ xác nhận</option>
                        <option value="processing">Đang xử lý</option>
                        <option value="shipping">Đang giao hàng</option>
                        <option value="delivered">Đã giao hàng</option>
                        <option value="cancelled">Đã hủy</option>
                      </select>
                    </div>
                    
                    {/* Clear filters button */}
                    {(searchTerm || searchStatus) && (
                      <button
                        onClick={clearFilters}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Xóa bộ lọc
                      </button>
                    )}
                  </div>
                </div>
              )}
              
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
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Search size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Không tìm thấy đơn hàng nào phù hợp</p>
                  <button
                    onClick={clearFilters}
                    className="mt-4 px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredOrders.map((order) => (
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
                      
                      <div className="mt-4 flex justify-between items-center">
                        <button
                          onClick={() => navigate(`/order-confirmation/${order.id}`)}
                          className="text-sm text-black hover:underline"
                        >
                          Xem chi tiết đơn hàng
                        </button>
                        
                        {canCancelOrder(order.status) && (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            disabled={isCancelling && cancellingOrderId === order.id}
                            className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isCancelling && cancellingOrderId === order.id ? (
                              <>
                                <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Đang hủy...
                              </>
                            ) : (
                              <>
                                <X className="w-4 h-4 mr-1" />
                                Hủy đơn hàng
                              </>
                            )}
                          </button>
                        )}
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