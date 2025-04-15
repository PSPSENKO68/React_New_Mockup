import { useState, FormEvent, useEffect } from 'react';
import { CreditCard, Truck, MapPin, AlertCircle, User, UserPlus } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getOrCreateAnonymousId } from '../utils/userIdentifier';
import VNPayCheckout from '../components/VNPayCheckout';
import GHNService from '../lib/ghnService';
import { moveFilesFromTempToOrder, updateOrderItemFilePaths } from '../utils/fileStorage';
import { decreaseInventoryOnOrderCreation } from '../lib/inventoryManager';
import { useAuth } from '../contexts/AuthContext';

type PaymentMethod = 'cod' | 'vnpay';
type ShippingMethod = 'standard' | 'express';

interface LocationOption {
  id: number | string;
  name: string;
}

// Dữ liệu địa điểm mặc định khi API không hoạt động
const FALLBACK_PROVINCES: LocationOption[] = [
  { id: 201, name: 'Hà Nội' },
  { id: 202, name: 'TP. Hồ Chí Minh' },
  { id: 203, name: 'Đà Nẵng' },
  { id: 204, name: 'Hải Phòng' },
  { id: 205, name: 'Cần Thơ' }
];

const FALLBACK_DISTRICTS: Record<string, LocationOption[]> = {
  '201': [
    { id: 1478, name: 'Quận Ba Đình' },
    { id: 1479, name: 'Quận Hoàn Kiếm' },
    { id: 1480, name: 'Quận Tây Hồ' }
  ],
  '202': [
    { id: 1442, name: 'Quận 1' },
    { id: 1443, name: 'Quận 3' },
    { id: 1444, name: 'Quận 4' },
    { id: 1446, name: 'Quận 5' }
  ]
};

const FALLBACK_WARDS: Record<string, LocationOption[]> = {
  '1442': [
    { id: '10000', name: 'Phường Bến Nghé' },
    { id: '10001', name: 'Phường Bến Thành' }
  ],
  '1478': [
    { id: '20000', name: 'Phường Phúc Xá' },
    { id: '20001', name: 'Phường Trúc Bạch' }
  ]
};

export function Payment() {
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [showVNPayCheckout, setShowVNPayCheckout] = useState(false);
  const { items, clearCart } = useCart();
  const [orderCreated, setOrderCreated] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Location data
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  
  // API status tracking
  const [apiAvailable, setApiAvailable] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Phone validation
  const [phoneError, setPhoneError] = useState<string | null>(null);
  
  // Shipping fee calculation
  const [shippingFee, setShippingFee] = useState(0);
  const [calculatingFee, setCalculatingFee] = useState(false);
  
  // Profile data loading status
  const [loadingUserProfile, setLoadingUserProfile] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    provinceId: '',
    districtId: '',
    wardCode: '',
    phoneNumber: '',
    email: '',
    notes: ''
  });

  // Add state for image URLs, similar to Cart component
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  
  // Load public URLs for stored images when cart items change
  useEffect(() => {
    const loadImageUrls = async () => {
      const urlMap: Record<string, string> = {};
      
      for (const item of items) {
        // Process mockup2D paths
        if (item.mockup2D && item.mockup2D.startsWith('temp/')) {
          const { data } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.mockup2D);
          
          if (data.publicUrl) {
            urlMap[item.mockup2D] = data.publicUrl + `?t=${Date.now()}`; // Add timestamp to force reload
          }
        }
        
        // Process customDesign paths
        if (item.customDesign && item.customDesign.startsWith('temp/')) {
          const { data } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.customDesign);
          
          if (data.publicUrl) {
            urlMap[item.customDesign] = data.publicUrl + `?t=${Date.now()}`; // Add timestamp to force reload
          }
        }
      }
      
      setImageUrls(urlMap);
    };
    
    loadImageUrls();
  }, [items]);
  
  // Helper function to get the correct image URL
  const getImageUrl = (path: string | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    if (path.startsWith('data:')) return path;
    if (path.startsWith('temp/') && imageUrls[path]) return imageUrls[path];
    
    // Return a placeholder if image not found
    return undefined;
  };

  // Calculate subtotal from cart
  const subtotal = items.reduce((total, item) => {
    return total + (item.price * (item.quantity || 1));
  }, 0);

  const total = subtotal + shippingFee;

  // Load provinces on component mount
  useEffect(() => {
    fetchProvinces();
  }, []);

  // When province changes, load districts
  useEffect(() => {
    if (formData.provinceId) {
      fetchDistricts(Number(formData.provinceId));
      // Reset district and ward
      setFormData(prev => ({
        ...prev,
        districtId: '',
        wardCode: ''
      }));
      setWards([]);
    }
  }, [formData.provinceId]);

  // When district changes, load wards
  useEffect(() => {
    if (formData.districtId) {
      fetchWards(Number(formData.districtId));
      // Reset ward
      setFormData(prev => ({
        ...prev,
        wardCode: ''
      }));
    }
  }, [formData.districtId]);

  // When location is complete or shipping method changes, calculate shipping fee
  useEffect(() => {
    if (formData.districtId && formData.wardCode) {
      if (apiAvailable) {
        calculateShippingFee();
      } else {
        calculateFallbackShippingFee();
      }
    }
  }, [formData.districtId, formData.wardCode, shippingMethod, apiAvailable]);

  // Load provinces from GHN service or use fallback
  async function fetchProvinces() {
    try {
      setLoadingLocation(true);
      const data = await GHNService.getProvinces();
      
      // Check if valid data returned
      if (Array.isArray(data) && data.length > 0) {
        setProvinces(data.map((province: any) => ({
          id: province.ProvinceID,
          name: province.ProvinceName
        })));
        setApiAvailable(true);
        setApiError(null);
      } else {
        throw new Error('Invalid data from GHN API');
      }
    } catch (error: any) {
      console.error('Error fetching provinces:', error);
      // Use fallback data
      setProvinces(FALLBACK_PROVINCES);
      setApiAvailable(false);
      setApiError(error.message || 'Không thể kết nối đến dịch vụ vận chuyển');
    } finally {
      setLoadingLocation(false);
    }
  }

  // Load districts based on selected province
  async function fetchDistricts(provinceId: number) {
    try {
      setLoadingLocation(true);
      
      if (!apiAvailable) {
        // Use fallback data if API not available
        const fallbackData = FALLBACK_DISTRICTS[provinceId.toString()] || [];
        setDistricts(fallbackData);
        return;
      }
      
      const data = await GHNService.getDistricts(provinceId);
      setDistricts(data.map((district: any) => ({
        id: district.DistrictID,
        name: district.DistrictName
      })));
    } catch (error) {
      console.error('Error fetching districts:', error);
      // Use fallback data
      const fallbackData = FALLBACK_DISTRICTS[provinceId.toString()] || [];
      setDistricts(fallbackData);
      setApiAvailable(false);
    } finally {
      setLoadingLocation(false);
    }
  }

  // Load wards based on selected district
  async function fetchWards(districtId: number) {
    try {
      setLoadingLocation(true);
      
      if (!apiAvailable) {
        // Use fallback data if API not available
        const fallbackData = FALLBACK_WARDS[districtId.toString()] || [];
        setWards(fallbackData);
        return;
      }
      
      const data = await GHNService.getWards(districtId);
      setWards(data.map((ward: any) => ({
        id: ward.WardCode,
        name: ward.WardName
      })));
    } catch (error) {
      console.error('Error fetching wards:', error);
      // Use fallback data
      const fallbackData = FALLBACK_WARDS[districtId.toString()] || [];
      setWards(fallbackData);
      setApiAvailable(false);
    } finally {
      setLoadingLocation(false);
    }
  }

  // Calculate fallback shipping fee when API is not available
  function calculateFallbackShippingFee() {
    setCalculatingFee(true);
    
    try {
      // Calculate based on item count and shipping method
      const itemCount = items.reduce((total, item) => total + (item.quantity || 1), 0);
      
      // Base price for standard shipping
      let basePrice = 4.99;
      // Additional price per item after the first
      let additionalPrice = 0.99;
      
      if (shippingMethod === 'express') {
        basePrice = 9.99;
        additionalPrice = 1.99;
      }
      
      // Calculate total shipping fee
      const fee = basePrice + Math.max(0, itemCount - 1) * additionalPrice;
      
      setShippingFee(fee);
    } catch (error) {
      console.error('Error calculating fallback shipping fee:', error);
      // Set a default shipping fee if calculation fails
      setShippingFee(shippingMethod === 'standard' ? 4.99 : 9.99);
    } finally {
      setCalculatingFee(false);
    }
  }

  // Calculate shipping fee from GHN
  async function calculateShippingFee() {
    if (!formData.districtId || !formData.wardCode) return;

    try {
      setCalculatingFee(true);
      
      // Calculate total weight (in grams) - assume 100g per case
      const weight = items.reduce((total, item) => {
        return total + ((item.quantity || 1) * 100);
      }, 0);
      
      // Prepare params for GHN
      const params = {
        fromDistrictId: Number(import.meta.env.VITE_GHN_DISTRICT_ID || 1454), // Shop district ID
        toDistrictId: Number(formData.districtId),
        toWardCode: formData.wardCode,
        weight: weight,
        // Assume standard box dimensions
        length: 20,
        width: 10,
        height: 5,
        // Insure for the total value of the items
        insuranceValue: Math.round(subtotal * 23000) // Convert to VND (approximate)
      };
      
      const response = await GHNService.calculateShippingFee(params);
      
      // Check if valid data returned
      if (response && typeof response === 'object' && ('total' in response)) {
        // Adjust fee based on shipping method (express is 30% more)
        let fee: number = Number(response.total) || 0;
        if (shippingMethod === 'express') {
          fee = Math.round(fee * 1.3);
        }
        
        // Convert from VND to USD (approximate)
        setShippingFee(Math.round((fee / 23000) * 100) / 100);
      } else {
        // If API returns invalid data, fallback to default calculation
        calculateFallbackShippingFee();
      }
    } catch (error) {
      console.error('Error calculating shipping fee:', error);
      // API failed, use fallback calculation
      calculateFallbackShippingFee();
      setApiAvailable(false);
    } finally {
      setCalculatingFee(false);
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validate phone number when it changes
    if (name === 'phoneNumber') {
      validatePhoneNumber(value);
    }
  };

  // Function to validate Vietnamese phone numbers
  const validatePhoneNumber = (phone: string) => {
    // Xóa khoảng trắng và dấu gạch ngang
    const cleanedPhone = phone.replace(/[\s-]/g, '');
    
    // Kiểm tra độ dài và định dạng
    const vietnamesePhoneRegex = /^(0|84|\+84)([3|5|7|8|9])[0-9]{8}$/;
    
    if (!phone) {
      setPhoneError('Vui lòng nhập số điện thoại');
    } else if (!vietnamesePhoneRegex.test(cleanedPhone)) {
      setPhoneError('Số điện thoại không hợp lệ. Số điện thoại Việt Nam phải có 10 số và bắt đầu bằng 03, 05, 07, 08, 09');
    } else {
      setPhoneError(null);
    }
    
    return !phoneError;
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      alert("Vui lòng thêm sản phẩm vào giỏ hàng trước khi thanh toán");
      navigate('/cart');
      return;
    }

    // Validate form
    const requiredFields = ['fullName', 'address', 'phoneNumber', 'email', 'provinceId', 'districtId', 'wardCode'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }
    
    // Validate phone before submitting
    if (!validatePhoneNumber(formData.phoneNumber)) {
      return;
    }

    setIsLoading(true);

    try {
      // Get the anonymous ID or create a new one if not available
      const anonymousId = getOrCreateAnonymousId();
      
      // Get location names for order address
      const provinceName = provinces.find(p => p.id === Number(formData.provinceId))?.name || '';
      const districtName = districts.find(d => d.id === Number(formData.districtId))?.name || '';
      const wardName = wards.find(w => w.id === formData.wardCode)?.name || '';
      
      // Formatted full address
      const fullAddress = `${formData.address}, ${wardName}, ${districtName}, ${provinceName}`;
      
      console.log('Creating order with data:', {
        full_name: formData.fullName,
        shipping_address: fullAddress,
        phone_number: formData.phoneNumber,
        email: formData.email,
        payment_method: paymentMethod,
        payment_status: 'pending',
        shipping_fee: shippingFee,
        subtotal: subtotal,
        total: total
      });
      
      // Create order in database
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          full_name: formData.fullName,
          shipping_address: fullAddress,
          phone_number: formData.phoneNumber,
          email: formData.email,
          payment_method: paymentMethod,
          payment_status: 'pending',
          shipping_fee: shippingFee,
          subtotal: subtotal,
          total: total,
          notes: formData.notes || null,
          status: 'pending',
          has_ghn_order: false,
          // Use userId if logged in, otherwise store anonymousId
          user_id: user ? user.id : null,
          anonymous_id: !user ? anonymousId : null
        })
        .select('id')
        .single();

      if (orderError) {
        console.error('Supabase order creation error:', orderError);
        throw new Error(`Database error: ${orderError.message}`);
      }

      if (!orderData || !orderData.id) {
        throw new Error('No order ID returned from database');
      }

      console.log('Order created successfully with ID:', orderData.id);

      // Create order_items for each product
      const orderItemsData = items.map(item => {
        // Kiểm tra xem item có phải là thiết kế tùy chỉnh không (có customDesign hoặc mockup2D)
        if (item.customDesign || item.mockup2D) {
          return {
            order_id: orderData.id,
            inventory_item_id: item.inventoryItemId,
            custom_design_url: item.customDesign || null,
            mockup_design_url: item.mockup2D || null,
            quantity: item.quantity || 1,
            price: item.price
          };
        } else {
          // Đây là sản phẩm thông thường
          return {
            order_id: orderData.id,
            inventory_item_id: item.inventoryItemId,
            custom_design_url: null,
            mockup_design_url: null,
            quantity: item.quantity || 1,
            price: item.price
          };
        }
      });

      console.log('Order items data:', orderItemsData);

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsData);

      if (itemsError) {
        console.error('Supabase order items creation error:', itemsError);
        throw new Error(`Database error: ${itemsError.message}`);
      }

      // Save order ID for further processing
      setOrderCreated(orderData.id);

      // Update inventory quantities after order creation
      try {
        const inventoryResult = await decreaseInventoryOnOrderCreation(orderData.id);
        if (inventoryResult.success) {
          console.log(inventoryResult.message);
        } else {
          console.error('Error updating inventory:', inventoryResult.message);
        }
      } catch (inventoryError) {
        console.error('Failed to update inventory:', inventoryError);
        // Continue with order process even if inventory update fails
      }

      // Handle payment method
      if (paymentMethod === 'vnpay') {
        // Show VNPay checkout component
        setShowVNPayCheckout(true);
      } else {
        // COD payment - We no longer create GHN orders automatically
        // if (apiAvailable) {
        //   try {
        //     await createShippingOrder(orderData.id, fullAddress);
        //   } catch (error) {
        //     console.error('Error creating shipping order:', error);
        //     // Continue even if shipping creation fails
        //   }
        // }
        
        // Di chuyển file từ thư mục temp sang order khi đặt hàng thành công
        try {
          const { success, newPaths } = await moveFilesFromTempToOrder(anonymousId);
          
          if (success && newPaths.length > 0) {
            console.log(`Successfully moved ${newPaths.length} files to order folder`);
            
            // Cập nhật đường dẫn file trong bảng order_items
            for (const item of orderItemsData) {
              if (item.custom_design_url && item.custom_design_url.startsWith('temp/')) {
                const oldPath = item.custom_design_url;
                const newPath = `order/${anonymousId}/${oldPath.split('/').pop()}`;
                await updateOrderItemFilePaths(orderData.id, oldPath, newPath);
              }
              
              if (item.mockup_design_url && item.mockup_design_url.startsWith('temp/')) {
                const oldPath = item.mockup_design_url;
                const newPath = `order/${anonymousId}/${oldPath.split('/').pop()}`;
                await updateOrderItemFilePaths(orderData.id, oldPath, newPath);
              }
            }
          }
        } catch (fileError) {
          console.error('Error moving files:', fileError);
          // Tiếp tục xử lý đơn hàng ngay cả khi có lỗi di chuyển file
        }
        
        // Redirect to confirmation page
        clearCart();
        navigate(`/order-confirmation/${orderData.id}`);
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      alert(`Đã xảy ra lỗi khi đặt hàng: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVNPaySuccess = (url: string) => {
    // Redirect to VNPay payment gateway
    window.location.href = url;
  };

  // Load user profile data when user is logged in
  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);
  
  // Fetch user profile data from Supabase
  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      setLoadingUserProfile(true);
      
      // Fetch user profile from the database
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }
      
      if (data) {
        // Pre-fill form with user data (only personal info, not address)
        setFormData(prev => ({
          ...prev,
          fullName: data.full_name || prev.fullName,
          phoneNumber: data.phone || prev.phoneNumber,
          email: data.email || user.email || prev.email
        }));
      }
    } catch (error) {
      console.error('Error loading user profile data:', error);
    } finally {
      setLoadingUserProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Thanh toán</h1>
          
          {/* API Error Notification */}
          {apiError && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Không thể kết nối đến dịch vụ vận chuyển. Đang sử dụng phí vận chuyển ước tính.
                  </p>
                </div>
              </div>
            </div>
          )}

          {showVNPayCheckout && orderCreated ? (
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Thanh toán với VNPAY</h2>
              <VNPayCheckout 
                orderId={orderCreated}
                onPaymentCreated={handleVNPaySuccess}
                onError={(err) => {
                  alert(`Lỗi thanh toán: ${err.message}`);
                  setShowVNPayCheckout(false);
                }}
              />
            </div>
          ) : (
            <form onSubmit={handlePlaceOrder}>
              <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                  {/* User Account Information */}
                  {!user && (
                    <div className="bg-yellow-50 border-yellow-200 border p-4 rounded-lg mb-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <User className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            Đăng nhập là tùy chọn
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>
                              Bạn không cần đăng nhập để mua hàng. Tuy nhiên, email là bắt buộc để theo dõi đơn hàng. Nếu đăng nhập, bạn có thể xem toàn bộ lịch sử đơn hàng đã đặt với cùng email trong trang tài khoản.
                            </p>
                          </div>
                          <div className="mt-3 flex space-x-2">
                            <Link 
                              to="/account/login" 
                              className="flex items-center gap-1 bg-black text-white px-3 py-1.5 text-sm font-medium rounded-md"
                            >
                              <User className="h-4 w-4" />
                              Đăng nhập
                            </Link>
                            <Link 
                              to="/account/register" 
                              className="flex items-center gap-1 bg-white border-black border text-black px-3 py-1.5 text-sm font-medium rounded-md"
                            >
                              <UserPlus className="h-4 w-4" />
                              Đăng ký
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Shipping Information */}
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Thông tin giao hàng
                    </h2>
                    
                    {/* Pre-fill form if user is logged in */}
                    {user && (
                      <div className="bg-green-50 border-green-200 border p-4 rounded-lg mb-4">
                        <p className="text-green-800 text-sm">
                          Đã đăng nhập với tài khoản: <span className="font-medium">{user.email}</span>
                          {loadingUserProfile && (
                            <span className="ml-2 inline-block">
                              <span className="inline-block w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></span>
                              <span className="ml-1">Đang tải thông tin...</span>
                            </span>
                          )}
                        </p>
                        {!loadingUserProfile && (
                          <p className="text-green-700 text-xs mt-1">Thông tin cá nhân của bạn đã được điền tự động. Email sẽ được lấy từ tài khoản và không thể thay đổi. Vui lòng điền thông tin địa chỉ giao hàng.</p>
                        )}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Họ tên người nhận <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-gray-300 rounded-md"
                          placeholder="Nhập họ tên người nhận"
                          required
                          disabled={loadingUserProfile}
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Số điện thoại <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          className={`w-full p-3 border ${phoneError ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                          placeholder="Nhập số điện thoại (VD: 0987654321)"
                          required
                          disabled={loadingUserProfile}
                        />
                        {phoneError && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" /> {phoneError}
                          </p>
                        )}
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`w-full p-3 border border-gray-300 rounded-md ${user ? 'bg-gray-50' : ''}`}
                          placeholder="Nhập email"
                          required
                          disabled={loadingUserProfile || !!user}
                        />
                        {user && (
                          <p className="text-xs text-gray-500 mt-1">
                            Email được liên kết với tài khoản của bạn và không thể thay đổi.
                          </p>
                        )}
                      </div>
                      
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tỉnh/Thành phố <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="provinceId"
                          value={formData.provinceId}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-gray-300 rounded-md"
                          required
                          disabled={loadingLocation}
                        >
                          <option value="">Chọn Tỉnh/Thành phố</option>
                          {provinces.map(province => (
                            <option key={province.id} value={province.id}>
                              {province.name}
                            </option>
                          ))}
                        </select>
                    </div>

                      <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quận/Huyện <span className="text-red-500">*</span>
                      </label>
                        <select
                          name="districtId"
                          value={formData.districtId}
                        onChange={handleInputChange}
                          className="w-full p-3 border border-gray-300 rounded-md"
                        required
                          disabled={!formData.provinceId || loadingLocation}
                        >
                          <option value="">Chọn Quận/Huyện</option>
                          {districts.map(district => (
                            <option key={district.id} value={district.id}>
                              {district.name}
                            </option>
                          ))}
                        </select>
                    </div>
                    
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phường/Xã <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="wardCode"
                          value={formData.wardCode}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-gray-300 rounded-md"
                          required
                          disabled={!formData.districtId || loadingLocation}
                        >
                          <option value="">Chọn Phường/Xã</option>
                          {wards.map(ward => (
                            <option key={ward.id} value={ward.id}>
                              {ward.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Địa chỉ cụ thể <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-gray-300 rounded-md"
                          placeholder="Số nhà, tên đường, tòa nhà, ..."
                          required
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ghi chú
                        </label>
                        <textarea
                          name="notes"
                          value={formData.notes}
                          onChange={handleInputChange}
                          className="w-full p-3 border border-gray-300 rounded-md"
                          placeholder="Ghi chú về đơn hàng, ví dụ: thời gian hay chỉ dẫn địa điểm giao hàng chi tiết hơn"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                    
                  {/* Payment Method */}
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Phương thức thanh toán
                    </h2>
                    <div className="space-y-3">
                      <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={paymentMethod === 'cod'}
                          onChange={() => setPaymentMethod('cod')}
                          className="w-4 h-4"
                        />
                        <span className="ml-3">Thanh toán khi nhận hàng (COD)</span>
                      </label>
                      <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="vnpay"
                          checked={paymentMethod === 'vnpay'}
                          onChange={() => setPaymentMethod('vnpay')}
                          className="w-4 h-4"
                        />
                        <span className="ml-3">Thanh toán qua VNPAY</span>
                      </label>
                      </div>
                    </div>
                    
                  {/* Shipping Method */}
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      Phương thức vận chuyển
                    </h2>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="shipping"
                            value="standard"
                            checked={shippingMethod === 'standard'}
                            onChange={() => setShippingMethod('standard')}
                            className="w-4 h-4"
                          />
                          <span className="ml-3">Giao hàng tiêu chuẩn (2-3 ngày)</span>
                        </div>
                        <span className="font-semibold">
                          {calculatingFee ? 'Đang tính...' : `$${shippingFee.toFixed(2)}`}
                        </span>
                      </label>
                      <label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="shipping"
                            value="express"
                            checked={shippingMethod === 'express'}
                            onChange={() => setShippingMethod('express')}
                            className="w-4 h-4"
                          />
                          <span className="ml-3">Giao hàng nhanh (1 ngày)</span>
                        </div>
                        <span className="font-semibold">
                          {calculatingFee ? 'Đang tính...' : `$${(shippingFee * 1.3).toFixed(2)}`}
                        </span>
                      </label>
                  </div>
                </div>
              </div>

              {/* Order Summary */}
                <div className="md:col-span-1">
                  <div className="bg-white p-6 rounded-lg shadow-sm sticky top-24">
                    <h2 className="text-xl font-semibold mb-4">Tóm tắt đơn hàng</h2>
                    
                    <div className="space-y-4 mb-4">
                  <div className="flex justify-between">
                        <span className="text-gray-600">Tạm tính</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                      
                  <div className="flex justify-between">
                        <span className="text-gray-600">Phí vận chuyển</span>
                        <span>
                          {calculatingFee ? 'Đang tính...' : `$${shippingFee.toFixed(2)}`}
                        </span>
                      </div>
                      
                      <div className="border-t pt-4 flex justify-between font-semibold">
                        <span>Tổng cộng</span>
                        <span className="text-lg">${total.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={isLoading || calculatingFee}
                      className={`w-full py-3 px-4 bg-indigo-600 text-white rounded-md flex items-center justify-center ${
                        isLoading || calculatingFee ? 'opacity-70 cursor-not-allowed' : 'hover:bg-indigo-700'
                      }`}
                    >
                      {isLoading ? 'Đang xử lý...' : 'Đặt hàng'}
                    </button>
                    
                    <div className="mt-4 text-sm text-gray-500">
                      Bằng cách nhấn "Đặt hàng", bạn đồng ý với điều khoản dịch vụ và chính sách bảo mật của chúng tôi.
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="font-medium mb-2">Đơn hàng của bạn ({items.length} sản phẩm)</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center space-x-3 text-sm">
                            <div className="relative w-10 h-14 flex-shrink-0">
                              {item.mockup2D ? (
                                <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
                                  <img 
                                    src={getImageUrl(item.mockup2D)} 
                                    alt={`${item.name} mockup`}
                                    className="max-h-full max-w-full object-contain"
                                    style={{ objectFit: 'scale-down' }}
                                  />
                                </div>
                              ) : item.customDesign ? (
                                <div className="relative w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                                  <img 
                                    src={getImageUrl(item.customDesign)} 
                                    alt={item.name}
                                    className="max-w-full max-h-full object-contain"
                                  />
                                  <div className="absolute inset-0 border border-gray-200 rounded-lg"></div>
                                </div>
                              ) : (
                                <img 
                                  src={item.image} 
                                  alt={item.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{item.name}</div>
                              <div className="text-gray-500">x{item.quantity || 1}</div>
                            </div>
                            <div className="font-medium">${item.price.toFixed(2)}</div>
                          </div>
                        ))}
                  </div>
                    </div>
                  </div>
              </div>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}