import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, ShoppingCart, X, Home, Palette, CreditCard, User } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

export function Navigation() {
  const { cartCount } = useCart();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  
  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Close menu when navigating to a new page
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const menuItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/custom-design', label: 'Design Your Case', icon: Palette },
    { path: '/cart', label: 'Cart', icon: ShoppingCart },
    { path: '/payment', label: 'Checkout', icon: CreditCard },
    ...(user 
      ? [{ path: '/account', label: 'Tài khoản của tôi', icon: User }] 
      : [{ path: '/account/login', label: 'Đăng nhập', icon: User }]
    ),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed w-full bg-white/80 backdrop-blur-sm z-50 py-4">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center justify-center"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 cursor-pointer" />
            ) : (
              <Menu className="h-6 w-6 cursor-pointer" />
            )}
          </button>
          
          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="p-2">
                {menuItems.map((item, index) => {
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={index}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                        isActive(item.path)
                          ? 'bg-black text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <IconComponent className="h-5 w-5" />
                      <span>{item.label}</span>
                      {item.path === '/cart' && cartCount > 0 && (
                        <span className="bg-black text-white text-xs w-5 h-5 rounded-full flex items-center justify-center ml-auto">
                          {cartCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        <Link to="/" className="text-2xl font-bold">LYLYCASE</Link>
        
        <div className="flex items-center gap-4">
          <Link to={user ? '/account' : '/account/login'} className="flex items-center gap-1">
            <User className="h-5 w-5" />
            <span className="text-sm hidden md:inline">
              {user ? 'Tài khoản' : 'Đăng nhập'}
            </span>
          </Link>
          
          <Link to="/cart" className="relative">
            <ShoppingCart className="h-6 w-6 cursor-pointer" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-black text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}