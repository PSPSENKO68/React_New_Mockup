import { Ghn } from 'giaohangnhanh';
import { supabase } from './supabase';
import getGHNConfig from './ghnConfig';

// Khởi tạo client GHN sử dụng cấu hình tập trung
let ghn: Ghn;

try {
  const config = getGHNConfig();
  // Đảm bảo shopId là số
  const numericShopId = typeof config.shopId === 'string' ? parseInt(config.shopId, 10) : config.shopId;
  ghn = new Ghn({
    ...config,
    shopId: numericShopId
  });
  console.log('Initialized GHN client with API host:', config.host);
} catch (error) {
  console.error('Failed to initialize GHN client:', error);
  // Vẫn tạo một instance để tránh lỗi trong quá trình thực thi
  ghn = new Ghn({
    token: '',
    shopId: 0,
    testMode: false,
    host: 'https://online-gateway.ghn.vn',
    trackingHost: 'https://tracking.ghn.vn'
  });
}

// Dữ liệu mẫu để trả về khi API không hoạt động
const FALLBACK_DATA = {
  provinces: [
    { ProvinceID: 201, ProvinceName: 'Hà Nội' },
    { ProvinceID: 202, ProvinceName: 'TP. Hồ Chí Minh' },
    { ProvinceID: 203, ProvinceName: 'Đà Nẵng' },
    { ProvinceID: 204, ProvinceName: 'Hải Phòng' },
    { ProvinceID: 205, ProvinceName: 'Cần Thơ' }
  ],
  districts: {
    '201': [
      { DistrictID: 1478, DistrictName: 'Quận Ba Đình' },
      { DistrictID: 1479, DistrictName: 'Quận Hoàn Kiếm' },
      { DistrictID: 1480, DistrictName: 'Quận Tây Hồ' }
    ],
    '202': [
      { DistrictID: 1442, DistrictName: 'Quận 1' },
      { DistrictID: 1443, DistrictName: 'Quận 3' },
      { DistrictID: 1444, DistrictName: 'Quận 4' },
      { DistrictID: 1446, DistrictName: 'Quận 5' }
    ]
  } as Record<string, Array<{DistrictID: number, DistrictName: string}>>,
  wards: {
    '1442': [
      { WardCode: '10000', WardName: 'Phường Bến Nghé' },
      { WardCode: '10001', WardName: 'Phường Bến Thành' }
    ],
    '1478': [
      { WardCode: '20000', WardName: 'Phường Phúc Xá' },
      { WardCode: '20001', WardName: 'Phường Trúc Bạch' }
    ]
  } as Record<string, Array<{WardCode: string, WardName: string}>>
};

// Define interfaces for GHN responses
// Define a more generic response type to handle potential edge cases
interface GHNGenericResponse {
  code?: number;
  message?: string;
  data?: any;
  [key: string]: any;
}

interface GHNOrderResponse {
  order_code: string;
  expected_delivery_time: string;
  status: string;
}

interface CreateOrderParams {
  // Add required properties from GHN API
  shop_id: number;
  to_name: string;
  to_phone: string;
  to_address: string;
  to_ward_code: string;
  to_district_id: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  service_id: number;
  payment_type_id: number;
  cod_amount?: number;
  orderId: string; // Custom field to link with our system
  [key: string]: any; // Allow additional properties
}

interface ShippingFeeParams {
  fromDistrictId: number;
  toDistrictId: number;
  toWardCode: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  insuranceValue?: number;
}

// Kiểm tra trạng thái kết nối và kết quả từ API GHN
let isGHNApiAvailable = true;

async function handleGHNResponse<T>(apiCall: () => Promise<any>, fallbackData?: T): Promise<T> {
  if (!isGHNApiAvailable && fallbackData) {
    console.log('Using fallback data due to previous API failures');
    return fallbackData;
  }

  try {
    const response = await apiCall() as GHNGenericResponse;
    
    // Kiểm tra cấu trúc response
    if (response && typeof response === 'object') {
      // Nếu có trường code, check code để xác định thành công/thất bại
      if ('code' in response) {
        const code = response.code;
        // GHN API thường trả về code 200 hoặc 400 dựa trên tài liệu
        if (code === 200 || code === 0) {
          isGHNApiAvailable = true;
          // Nhiều API của GHN có thể trả về trường 'data' hoặc trực tiếp là kết quả
          return 'data' in response ? response.data as T : response as unknown as T;
        } else {
          console.error(`GHN API error: Code ${code} - ${
            'message' in response && response.message ? response.message : 'Unknown error'
          }`);
          if (code === 401 || code === 403) {
            console.error('Authentication error with GHN API. Check token validity.');
          }
          isGHNApiAvailable = false;
          return fallbackData || ([] as unknown as T);
        }
      }
      
      // Nếu không có trường code nhưng có data
      if ('data' in response && response.data !== undefined) {
        isGHNApiAvailable = true;
        return response.data as T;
      }
    }
    
    // Trường hợp không xác định được cấu trúc
    isGHNApiAvailable = true;
    return response as unknown as T;
  } catch (error) {
    console.error('GHN API call failed:', error);
    isGHNApiAvailable = false;
    return fallbackData || ([] as unknown as T);
  }
}

// Kiểm tra API có sẵn sàng không
const checkAPIAvailability = async (): Promise<boolean> => {
  try {
    await ghn.address.getProvinces();
    isGHNApiAvailable = true;
    return true;
  } catch (error) {
    console.error('GHN API availability check failed:', error);
    isGHNApiAvailable = false;
    return false;
  }
};

/**
 * Service tương tác với Giao Hàng Nhanh API
 */
export const GHNService = {
  /**
   * Kiểm tra trạng thái API có khả dụng không
   */
  isAPIAvailable() {
    return isGHNApiAvailable;
  },
  
  /**
   * Kiểm tra kết nối đến API GHN
   */
  checkAPIAvailability,
  
  /**
   * Lấy danh sách tỉnh/thành phố
   */
  async getProvinces() {
    return handleGHNResponse(
      () => ghn.address.getProvinces(),
      FALLBACK_DATA.provinces
    );
  },

  /**
   * Lấy danh sách quận/huyện theo tỉnh/thành phố
   */
  async getDistricts(provinceId: number) {
    // Ensure provinceId is an integer
    const numericProvinceId = Number(provinceId);
    
    if (isNaN(numericProvinceId)) {
      console.error('Invalid province ID:', provinceId);
      return FALLBACK_DATA.districts['201']; // Return default data for Hanoi
    }
    
    return handleGHNResponse(
      () => ghn.address.getDistricts(numericProvinceId),
      FALLBACK_DATA.districts[numericProvinceId.toString()]
    );
  },

  /**
   * Lấy danh sách phường/xã theo quận/huyện
   */
  async getWards(districtId: number) {
    // Ensure districtId is an integer
    const numericDistrictId = Number(districtId);
    
    if (isNaN(numericDistrictId)) {
      console.error('Invalid district ID:', districtId);
      return FALLBACK_DATA.wards['1442']; // Return default data
    }
    
    return handleGHNResponse(
      () => ghn.address.getWards(numericDistrictId),
      FALLBACK_DATA.wards[numericDistrictId.toString()]
    );
  },

  /**
   * Tính phí giao hàng
   */
  async calculateShippingFee(params: ShippingFeeParams) {
    const { fromDistrictId, toDistrictId, toWardCode, weight, length = 15, width = 15, height = 10, insuranceValue = 0 } = params;
    
    return handleGHNResponse(
      () => ghn.calculateFee.calculateShippingFee({
        from_district_id: fromDistrictId,
        to_district_id: toDistrictId,
        to_ward_code: toWardCode,
        weight,
        length,
        width,
        height,
        insurance_value: insuranceValue,
        service_type_id: 2 // Giao hàng tiêu chuẩn
      } as any)
    );
  },

  /**
   * Tạo đơn hàng
   */
  async createOrder(params: CreateOrderParams) {
    try {
      console.log('Creating GHN order with params:', JSON.stringify(params, null, 2));
      
      const result = await ghn.order.createOrder(params as any) as GHNGenericResponse;
      console.log('GHN createOrder response:', JSON.stringify(result, null, 2));
      
      if (result && result.code === 200 && result.data) {
        const orderData = result.data as GHNOrderResponse;
        // Lưu thông tin vận chuyển vào database
        await supabase
          .from('shipping')
          .insert({
            orderId: params.orderId,
            provider: 'GHN',
            orderCode: orderData.order_code,
            expectedDeliveryTime: orderData.expected_delivery_time,
            status: 'ready_to_pick',
            fee: params.cod_amount || 0,
            trackingUrl: GHNService.getTrackingUrl(orderData.order_code)
          });
        
        return orderData;
      }
      
      throw new Error(`GHN API Error: ${result.code} - ${result.message || 'Unknown error'}`);
    } catch (error: any) {
      // Detailed error logging
      const errorMessage = error.message || 'Unknown error';
      const errorResponse = error.response?.data ? JSON.stringify(error.response.data) : 'No response data';
      
      console.error('GHN Create Order Error:', {
        message: errorMessage,
        params: params,
        response: errorResponse
      });
      
      throw new Error(`Không thể tạo đơn hàng: ${errorMessage}`);
    }
  },
  
  /**
   * Hủy đơn hàng
   */
  async cancelOrder(orderCode: string) {
    try {
      const result = await ghn.order.cancelOrder({ order_code: orderCode } as any) as GHNGenericResponse;
      
      if (result && result.code === 200) {
        // Cập nhật trạng thái trong database
        await supabase
          .from('shipping')
          .update({ status: 'cancelled' })
          .eq('orderCode', orderCode);
        
        return result.data;
      }
      
      throw new Error(result && result.message ? result.message : 'Không thể hủy đơn hàng');
    } catch (error: any) {
      console.error('GHN Cancel Order Error:', error.message);
      throw new Error('Không thể hủy đơn hàng: ' + error.message);
    }
  },
  
  /**
   * Lấy thông tin đơn hàng
   */
  async getOrderInfo(orderCode: string) {
    try {
      const result = await ghn.order.orderInfo({ order_code: orderCode } as any) as GHNGenericResponse;
      
      if (result && result.code === 200 && result.data) {
        const orderData = result.data as GHNOrderResponse;
        const ghnStatus = orderData.status;
        const mappedStatus = GHNService.mapGHNStatus(ghnStatus);
        
        // Cập nhật trạng thái trong database
        await supabase
          .from('shipping')
          .update({ status: mappedStatus })
          .eq('orderCode', orderCode);
        
        return orderData;
      }
      
      throw new Error(result && result.message ? result.message : 'Không thể lấy thông tin đơn hàng');
    } catch (error: any) {
      console.error('GHN Get Order Info Error:', error.message);
      throw new Error('Không thể lấy thông tin đơn hàng: ' + error.message);
    }
  },

  /**
   * Lấy URL theo dõi đơn hàng
   */
  getTrackingUrl(orderCode: string) {
    // Sử dụng cấu hình từ ghnConfig
    const { trackingHost } = getGHNConfig();
    return `${trackingHost}/?order_code=${orderCode}`;
  },

  /**
   * Map trạng thái GHN sang trạng thái hệ thống
   */
  mapGHNStatus(ghnStatus: string): string {
    const statusMap: Record<string, string> = {
      'ready_to_pick': 'ready_to_pick',
      'picking': 'picking',
      'picked': 'picked',
      'delivering': 'delivering',
      'delivered': 'delivered',
      'delivery_fail': 'delivery_failed',
      'waiting_to_return': 'returned',
      'return': 'returned',
      'return_transporting': 'returned',
      'return_sorting': 'returned',
      'returned': 'returned',
      'cancel': 'cancelled',
      'exception': 'cancelled'
    };
    
    return statusMap[ghnStatus] || 'pending';
  }
};

export default GHNService; 