import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Lock, CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const {loading: authLoading } = useAuth();

  // Kiểm tra nếu người dùng đã đăng nhập (từ link reset password)
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session && !authLoading) {
        // Nếu không có phiên và không phải đang tải, chuyển hướng về trang đăng nhập
        navigate('/account/login');
      }
    };
    
    checkSession();
  }, [authLoading, navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Kiểm tra mật khẩu
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp');
      setLoading(false);
      return;
    }

    try {
      // Cập nhật mật khẩu mới
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      // Hiển thị thông báo thành công
      setSuccess(true);
      
      // Xóa mật khẩu khỏi state
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi đặt lại mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Đặt lại mật khẩu
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Tạo mật khẩu mới cho tài khoản của bạn
          </p>
        </div>

        {success ? (
          <div className="rounded-md bg-green-50 p-4 text-center">
            <div className="flex justify-center">
              <CheckCircle className="h-6 w-6 text-green-400" />
            </div>
            <h3 className="text-lg font-medium text-green-800 mt-3">Mật khẩu đã được cập nhật!</h3>
            <div className="mt-2 text-sm text-green-700">
              <p>
                Mật khẩu của bạn đã được đặt lại thành công. Giờ đây bạn có thể đăng nhập bằng mật khẩu mới.
              </p>
            </div>
            <div className="mt-4">
              <Link
                to="/account/login"
                className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-600"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Đi đến trang đăng nhập
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="password" className="sr-only">
                  Mật khẩu mới
                </label>
                <div className="flex items-center relative">
                  <span className="absolute left-3 text-gray-400">
                    <Lock className="h-5 w-5" />
                  </span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-black focus:border-black focus:z-10 sm:text-sm"
                    placeholder="Mật khẩu mới"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="sr-only">
                  Nhập lại mật khẩu
                </label>
                <div className="flex items-center relative">
                  <span className="absolute left-3 text-gray-400">
                    <Lock className="h-5 w-5" />
                  </span>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-black focus:border-black focus:z-10 sm:text-sm"
                    placeholder="Nhập lại mật khẩu mới"
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:bg-gray-400"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang cập nhật...
                  </span>
                ) : (
                  'Cập nhật mật khẩu'
                )}
              </button>
            </div>
            
            <div className="flex items-center justify-center">
              <Link to="/account/login" className="text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft className="inline-block mr-1 h-4 w-4" />
                Quay lại đăng nhập
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 