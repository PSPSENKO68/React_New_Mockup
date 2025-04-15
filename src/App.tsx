import { Routes, Route, useLocation } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { Home } from './pages/Home';
import { CustomDesign } from './pages/CustomDesign';
import { Cart } from './pages/Cart';
import { Payment } from './pages/Payment';
import { Admin } from './pages/Admin';
import { AdminLogin } from './pages/AdminLogin';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import DebugInfo from './components/DebugInfo';
import { Diagnostic } from './pages/Diagnostic';
import { OrderConfirmation } from './pages/OrderConfirmation';
import { Login } from './pages/Account/Login';
import { Register } from './pages/Account/Register';
import { Account } from './pages/Account';
import { ConfirmEmail } from './pages/Account/ConfirmEmail';
import { ConfirmError } from './pages/Account/ConfirmError';

function App() {
  const location = useLocation();
  
  // Check if the current path is an admin route
  const isAdminRoute = location.pathname.startsWith('/admin');
  
  return (
    <AuthProvider>
      <CartProvider>
        <div className="min-h-screen bg-white">
          {/* Only show Navigation if not on admin routes */}
          {!isAdminRoute && <Navigation />}
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/custom-design" element={<CustomDesign />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/diagnostic" element={<Diagnostic />} />
            <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
            
            {/* Tài khoản người dùng */}
            <Route path="/account" element={<Account />} />
            <Route path="/account/login" element={<Login />} />
            <Route path="/account/register" element={<Register />} />
            <Route path="/account/confirm" element={<ConfirmEmail />} />
            <Route path="/account/confirm-error" element={<ConfirmError />} />
            
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
          </Routes>
          {/* Only show Footer if not on admin routes */}
          {!isAdminRoute && <Footer />}
          <DebugInfo />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;