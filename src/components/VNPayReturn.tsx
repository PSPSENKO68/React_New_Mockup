import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { moveFilesFromTempToOrder, updateOrderItemFilePaths } from '../utils/fileStorage';
import { getOrCreateAnonymousId } from '../utils/userIdentifier';
import { useCart } from '../contexts/CartContext';

export function VNPayReturn() {
  const [searchParams] = useSearchParams();
  const [paymentStatus, setPaymentStatus] = useState('Đang xử lý thanh toán...');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const anonymousUserId = getOrCreateAnonymousId();
  const { clearCart } = useCart();

  // Thêm useEffect để vô hiệu hóa scroll trên body khi component được mount
  useEffect(() => {
    // Lưu trạng thái scroll ban đầu
    const originalStyle = window.getComputedStyle(document.body).overflow;
    // Vô hiệu hóa scroll
    document.body.style.overflow = 'hidden';
    
    // Khôi phục lại khi component unmount
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  useEffect(() => {
    async function processPayment() {
      try {
        // Lấy các tham số quan trọng từ VNPay
        const responseCode = searchParams.get('vnp_ResponseCode');
        const transactionStatus = searchParams.get('vnp_TransactionStatus');
        const txnRef = searchParams.get('vnp_TxnRef');
        const amount = searchParams.get('vnp_Amount');
        const bankCode = searchParams.get('vnp_BankCode');
        const orderInfo = searchParams.get('vnp_OrderInfo');

        console.log('VNPay parameters:', {
          responseCode,
          transactionStatus,
          txnRef,
          amount,
          orderInfo
        });

        // Kiểm tra kết quả thanh toán
        if (responseCode === '00' && transactionStatus === '00') {
          setPaymentStatus('Thanh toán thành công! Đang xử lý đơn hàng...');
          setIsSuccess(true);

          // Lấy orderId từ orderInfo (Thanh toan don hang {orderId})
          // Format chuẩn của VNPay: "Thanh toan don hang 21f034df-9e57-416a-ba65-b35e640ebda5"
          const orderIdMatch = orderInfo?.match(/Thanh toan don hang (.*)/);
          const orderId = orderIdMatch ? orderIdMatch[1] : null;

          console.log('Extracted orderId from orderInfo:', orderId);

          if (orderId) {
            try {
              // Cập nhật trạng thái đơn hàng trong Supabase
              const { error: orderError } = await supabase
                .from('orders')
                .update({ payment_status: 'paid', payment_method: 'vnpay' })
                .eq('id', orderId);

              if (orderError) {
                console.error('Error updating order status:', orderError);
              } else {
                console.log('Successfully updated order status to paid');
                
                // Di chuyển các file từ thư mục temp sang thư mục order
                try {
                  console.log(`Moving files for user ${anonymousUserId} from temp to order folder`);
                  const { success, newPaths } = await moveFilesFromTempToOrder(anonymousUserId);
                  
                  if (success) {
                    console.log(`Successfully moved ${newPaths.length} files to order folder`);
                    
                    // Cập nhật đường dẫn file trong order_items
                    if (newPaths.length > 0) {
                      // Lấy danh sách order items
                      const { data: orderItems } = await supabase
                        .from('order_items')
                        .select('id, custom_design_url, mockup_design_url')
                        .eq('order_id', orderId);
                      
                      if (orderItems && orderItems.length > 0) {
                        for (const item of orderItems) {
                          // Cập nhật đường dẫn của custom_design_url
                          if (item.custom_design_url && item.custom_design_url.startsWith('temp/')) {
                            const fileName = item.custom_design_url.split('/').pop();
                            const newPath = `order/${anonymousUserId}/${fileName}`;
                            await updateOrderItemFilePaths(orderId, item.custom_design_url, newPath);
                          }
                          
                          // Cập nhật đường dẫn của mockup_design_url
                          if (item.mockup_design_url && item.mockup_design_url.startsWith('temp/')) {
                            const fileName = item.mockup_design_url.split('/').pop();
                            const newPath = `order/${anonymousUserId}/${fileName}`;
                            await updateOrderItemFilePaths(orderId, item.mockup_design_url, newPath);
                          }
                        }
                        
                        console.log('Updated file paths in order_items successfully');
                      }
                    }
                  } else {
                    console.error('Failed to move files from temp to order folder');
                  }
                } catch (fileError) {
                  console.error('Error moving files:', fileError);
                  // Tiếp tục xử lý ngay cả khi di chuyển file thất bại
                }
              }
            } catch (dbError) {
              console.error('Database error:', dbError);
            }
          }

          // Lưu thông tin vào localStorage để hiển thị trong trang xác nhận đơn hàng
          localStorage.setItem('lastPayment', JSON.stringify({
            txnRef,
            amount: amount ? parseInt(amount) / 100 : 0, // Chia cho 100 để lấy số tiền thực
            date: new Date().toISOString(),
            status: 'success',
            bankCode,
            orderId: orderId || ''
          }));

          // Xóa giỏ hàng sau khi thanh toán thành công
          try {
            await clearCart();
            console.log('Cart cleared successfully after payment');
          } catch (clearCartError) {
            console.error('Error clearing cart:', clearCartError);
          }

          // Chuyển hướng người dùng sau khi xử lý xong
          if (orderId) {
            navigate(`/order-confirmation/${orderId}`);
          } else {
            // Nếu không tìm thấy orderId, chuyển về trang chủ
            navigate('/');
          }
        } else {
          setPaymentStatus('Thanh toán thất bại!');
          setIsSuccess(false);

          // Lưu thông tin lỗi vào localStorage
          localStorage.setItem('lastPayment', JSON.stringify({
            txnRef,
            errorCode: responseCode,
            status: 'failed',
            message: getErrorMessage(responseCode || '')
          }));

          // Chuyển hướng người dùng sau 3 giây
          setTimeout(() => {
            navigate('/payment');
          }, 3000);
        }
      } catch (error) {
        console.error('Error processing VNPay return:', error);
        setPaymentStatus('Đã xảy ra lỗi khi xử lý thanh toán!');
        setIsSuccess(false);
        
        // Chuyển hướng người dùng sau 3 giây
        setTimeout(() => {
          navigate('/payment');
        }, 3000);
      }
    }

    processPayment();
  }, [searchParams, navigate, anonymousUserId, clearCart]);

  // Hàm lấy thông báo lỗi dựa trên mã lỗi VNPay
  function getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      '01': 'Giao dịch đã tồn tại',
      '02': 'Merchant không hợp lệ',
      '03': 'Dữ liệu gửi sang không đúng định dạng',
      '04': 'Khởi tạo giao dịch không thành công do Website đang bị tạm khóa',
      '05': 'Giao dịch không thành công do: Quý khách nhập sai mật khẩu thanh toán quá số lần quy định',
      '06': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch',
      '07': 'Giao dịch bị nghi ngờ là giao dịch gian lận',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán',
      '12': 'Giao dịch không thành công do: Thẻ bị khóa',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản không đủ số dư để thực hiện giao dịch',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày',
      '75': 'Ngân hàng thanh toán đang bảo trì',
      '99': 'Không xác định được lỗi'
    };

    return errorMessages[errorCode] || 'Lỗi không xác định';
  }

  return (
    <>
      {/* Overlay toàn màn hình để chặn người dùng tương tác */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        style={{ pointerEvents: 'all' }}
      />
      
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          {isSuccess === true && (
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
          
          {isSuccess === false && (
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          )}
          
          {isSuccess === null && (
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
          )}
          
          <h2 className="text-2xl font-bold mb-4">
            {isSuccess === true ? 'Thanh toán thành công' : 
             isSuccess === false ? 'Thanh toán thất bại' : 
             'Đang xử lý thanh toán'}
          </h2>
          
          <p className="text-gray-600 mb-8">{paymentStatus}</p>
          
          <div className="text-sm text-gray-500">
            {isSuccess === null ? 'Vui lòng đợi trong khi chúng tôi xử lý đơn hàng của bạn...' : 
            'Bạn sẽ được chuyển hướng tự động sau vài giây...'}
          </div>
        </div>
      </div>
    </>
  );
} 