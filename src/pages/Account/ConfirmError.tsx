import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export const ConfirmError = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Extract error details from URL hash or search params
  useEffect(() => {
    const hash = location.hash.substring(1);
    const searchParams = new URLSearchParams(hash || location.search);
    
    const error = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');
    
    if (error && errorCode) {
      console.log('Error:', error, 'Code:', errorCode, 'Description:', errorDescription);
    }
  }, [location]);

  const handleResendConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setMessage({
        type: 'error',
        text: 'Vui lòng nhập địa chỉ email của bạn'
      });
      return;
    }
    
    try {
      setLoading(true);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: 'https://lylycase.vercel.app/account/login'
        }
      });
      
      if (error) {
        throw error;
      }
      
      setMessage({
        type: 'success',
        text: 'Email xác nhận đã được gửi lại. Vui lòng kiểm tra hộp thư của bạn.'
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Đã xảy ra lỗi khi gửi lại email xác nhận.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <AlertTriangle className="h-12 w-12 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Liên kết xác nhận đã hết hạn</h1>
          <p className="mt-2 text-gray-600">
            Liên kết xác nhận email của bạn đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu gửi lại liên kết xác nhận.
          </p>
        </div>

        {message && (
          <div 
            className={`rounded-md p-4 mb-6 ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-center">
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
              )}
              <p>{message.text}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleResendConfirmation} className="mt-6">
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="example@example.com"
              required
            />
          </div>
          
          <div className="flex flex-col gap-3 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Đang gửi...' : 'Gửi lại email xác nhận'}
            </button>
            
            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={() => navigate('/account/login')}
                className="text-indigo-600 hover:text-indigo-500"
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => navigate('/account/register')}
                className="text-indigo-600 hover:text-indigo-500"
              >
                Đăng ký
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}; 