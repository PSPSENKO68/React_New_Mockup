/**
 * Cấu hình cho dịch vụ Giao Hàng Nhanh (GHN)
 * File này giúp quản lý các thông số cấu hình GHN tập trung tại một nơi
 */

// Lấy thông tin từ biến môi trường
const {
  VITE_GHN_TOKEN,
  VITE_GHN_SHOP_ID,
  VITE_GHN_DISTRICT_ID,
  VITE_GHN_WARD_CODE
} = import.meta.env;

// Cấu hình GHN
interface GHNConfig {
  token: string;
  shopId: string | number;
  districtId: number | null;
  wardCode: string | null;
  testMode: boolean;
  host: string;
  trackingHost: string;
}

/**
 * Trả về cấu hình cho dịch vụ GHN
 * 
 * Chú ý: Sử dụng host API chính thức thay vì URL dev
 * URL API dev có thể không hoạt động hoặc cần cấu hình riêng từ GHN
 */
function getGHNConfig(): GHNConfig {
  return {
    token: VITE_GHN_TOKEN || "",
    shopId: VITE_GHN_SHOP_ID ? parseInt(VITE_GHN_SHOP_ID as string) : 0,
    districtId: VITE_GHN_DISTRICT_ID ? parseInt(VITE_GHN_DISTRICT_ID as string) : null,
    wardCode: VITE_GHN_WARD_CODE || null,
    testMode: false,
    // Sử dụng URL API chính thức thay vì dev-online-gateway.ghn.vn
    host: 'https://online-gateway.ghn.vn',
    // URL theo dõi đơn hàng chính thức
    trackingHost: 'https://tracking.ghn.vn',
  };
}

export default getGHNConfig; 