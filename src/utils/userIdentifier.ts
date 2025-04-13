// Thời gian sống của cookie (1 năm)
const COOKIE_EXPIRY_DAYS = 365;
const ANONYMOUS_USER_ID_KEY = 'anonymousUserId';

/**
 * Tạo hoặc lấy ID người dùng ẩn danh từ cookie
 * @returns ID người dùng ẩn danh
 */
export function getOrCreateAnonymousId(): string {
  // Kiểm tra cookie đã tồn tại chưa
  const existingId = getCookie(ANONYMOUS_USER_ID_KEY);
  if (existingId) {
    return existingId;
  }

  // Nếu chưa có, tạo ID mới
  const newId = "user_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  
  // Lưu vào cookie với thời hạn 1 năm
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);
  
  document.cookie = `${ANONYMOUS_USER_ID_KEY}=${newId}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict`;
  
  return newId;
}

/**
 * Lấy giá trị cookie theo tên
 * @param name Tên cookie cần lấy
 * @returns Giá trị cookie hoặc null nếu không tìm thấy
 */
export function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1, c.length);
    }
    if (c.indexOf(nameEQ) === 0) {
      return c.substring(nameEQ.length, c.length);
    }
  }
  return null;
}

/**
 * Xóa cookie theo tên
 * @param name Tên cookie cần xóa
 */
export function removeCookie(name: string): void {
  document.cookie = `${name}=; Max-Age=-99999999; path=/`;
}

/**
 * Tạo tên file dựa trên ID người dùng ẩn danh
 * @param designType Loại thiết kế ('custom' hoặc 'mockup')
 * @returns Tên file với định danh người dùng
 */
export function createFilename(designType: string): string {
  const userId = getOrCreateAnonymousId();
  const timestamp = Date.now();
  return `${userId}/${designType}_${timestamp}.png`;
} 