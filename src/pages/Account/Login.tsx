import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User, AlertCircle, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState(false);
  const navigate = useNavigate();
  const { user, handleAuthError } = useAuth();

  // Sử dụng useEffect để kiểm tra user và navigate
  useEffect(() => {
    if (user) {
      navigate('/account');
    }
  }, [user, navigate]);

  // Nếu đang kiểm tra user, trả về null
  if (user) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsEmailUnconfirmed(false);
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        // Xử lý lỗi auth với AuthContext
        handleAuthError(authError);
        
        // Kiểm tra nếu lỗi là email chưa xác nhận
        if (authError.message.includes('Email not confirmed') || 
            authError.message.includes('not confirmed')) {
          setIsEmailUnconfirmed(true);
          throw new Error('Email chưa được xác nhận. Vui lòng kiểm tra hộp thư và xác nhận email của bạn.');
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Đăng nhập không thành công');
      }

      // Successfully authenticated
      navigate('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setError('Vui lòng nhập email của bạn');
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email
      });
      
      if (error) throw error;
      
      setError(null);
      alert('Email xác nhận đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi lại email xác nhận');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Đăng nhập
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Đăng nhập để xem lịch sử đơn hàng của bạn
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-black focus:border-black focus:z-10 sm:text-sm"
                placeholder="Email của bạn"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Mật khẩu
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-black focus:border-black focus:z-10 sm:text-sm"
                placeholder="Mật khẩu"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    {error}
                  </p>
                  {isEmailUnconfirmed && (
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      className="mt-2 flex items-center text-sm font-medium text-red-700 hover:text-red-900"
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      Gửi lại email xác nhận
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <User className="h-5 w-5 text-gray-300 group-hover:text-gray-400" />
              </span>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Chưa có tài khoản?{' '}
              <Link to="/account/register" className="font-medium text-black hover:text-gray-800">
                Đăng ký
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
} 