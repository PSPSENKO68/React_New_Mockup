import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  handleAuthError: (error: any) => void;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  loading: true,
  handleAuthError: () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Xử lý lỗi xác thực - sử dụng useCallback để tránh tạo lại hàm mỗi lần render
  const handleAuthError = useCallback((error: any) => {
    // Kiểm tra nếu là lỗi token hết hạn hoặc không hợp lệ
    if (
      error?.message?.includes('token expired') ||
      error?.message?.includes('token is invalid') ||
      error?.message?.includes('Email link is invalid or has expired')
    ) {
      // Chuyển hướng người dùng đến trang confirm-error
      navigate('/account/confirm-error');
    }
  }, [navigate]);

  // Kiểm tra URL hash trong useEffect riêng biệt
  useEffect(() => {
    if (
      location.hash.includes('error=access_denied') || 
      location.hash.includes('error_code=otp_expired')
    ) {
      navigate('/account/confirm-error');
    }
  }, [location.hash, navigate]);

  // Kiểm tra phiên đăng nhập
  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        handleAuthError(error);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [handleAuthError]);

  return (
    <AuthContext.Provider value={{ user, loading, handleAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};