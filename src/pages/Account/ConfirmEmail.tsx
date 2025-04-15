import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [error, setError] = useState<string | null>(null);

  // Lấy token từ URL
  const token = searchParams.get('token');
  const type = searchParams.get('type');

  // Xử lý xác nhận email
  useEffect(() => {
    const verifyToken = async () => {
      if (!token || type !== 'signup') {
        setStatus('error');
        setError('Link xác nhận không hợp lệ hoặc đã hết hạn');
        return;
      }

      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'signup'
        });

        if (error) {
          throw error;
        }

        setStatus('success');
      } catch (err) {
        console.error('Lỗi xác nhận email:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi xác nhận email');
      }
    };

    verifyToken();
  }, [token, type]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black mx-auto"></div>
          <p className="text-gray-600">Đang xác thực email của bạn, vui lòng đợi...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-sm">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Xác thực không thành công</h2>
            <p className="mt-2 text-gray-600">
              {error || 'Liên kết xác nhận không hợp lệ hoặc đã hết hạn.'}
            </p>
          </div>
          
          <div className="flex flex-col space-y-4 mt-8">
            <Link
              to="/account/login"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            >
              Quay lại đăng nhập
            </Link>
            
            <Link
              to="/account/register"
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Đăng ký tài khoản mới
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-sm">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Email đã được xác nhận!</h2>
          <p className="mt-2 text-gray-600">
            Tài khoản của bạn đã được kích hoạt thành công.<br />
            Bây giờ bạn có thể đăng nhập để truy cập tài khoản của mình.
          </p>
        </div>
        
        <div className="mt-8">
          <Link
            to="/account/login"
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
          >
            Đăng nhập ngay <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
} 