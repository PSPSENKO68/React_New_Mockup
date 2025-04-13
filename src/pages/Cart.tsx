import { Link } from 'react-router-dom';
import { Trash2, ChevronRight, AlertCircle, Loader, Plus, Minus, Edit2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getOrCreateAnonymousId } from '../utils/userIdentifier';

export function Cart() {
  const { items, removeFromCart, updateQuantity, isLoading, error } = useCart();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  
  // Lấy ID người dùng cho việc logging
  const anonymousUserId = getOrCreateAnonymousId();
  
  useEffect(() => {
    // Log để kiểm tra
    console.log(`Current anonymous user ID: ${anonymousUserId}`);
  }, [anonymousUserId]);
  
  // Load public URLs for stored images when cart items change
  useEffect(() => {
    const loadImageUrls = async () => {
      const urlMap: Record<string, string> = {};
      
      for (const item of items) {
        // Process mockup2D paths
        if (item.mockup2D && item.mockup2D.startsWith('temp/')) {
          const { data } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.mockup2D);
          
          if (data.publicUrl) {
            urlMap[item.mockup2D] = data.publicUrl + `?t=${Date.now()}`; // Add timestamp to force reload
          }
        }
        
        // Process customDesign paths
        if (item.customDesign && item.customDesign.startsWith('temp/')) {
          const { data } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.customDesign);
          
          if (data.publicUrl) {
            urlMap[item.customDesign] = data.publicUrl + `?t=${Date.now()}`; // Add timestamp to force reload
          }
        }
      }
      
      setImageUrls(urlMap);
    };
    
    loadImageUrls();
  }, [items]);
  
  // Helper function to get the correct image URL
  const getImageUrl = (path: string | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    if (path.startsWith('data:')) return path;
    if (path.startsWith('temp/') && imageUrls[path]) return imageUrls[path];
    
    // Return a placeholder if image not found
    return undefined;
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Shopping Cart</h1>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <Loader className="animate-spin h-8 w-8 text-black" />
            </div>
          )}

          {!isLoading && items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-6">Your cart is empty</p>
              <Link 
                to="/custom-design"
                className="inline-block bg-black text-white px-8 py-3 rounded-full hover:bg-gray-800 transition"
              >
                Start Designing
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm">
                    <div className="flex gap-6">
                      <div className="relative w-24 h-36 flex-shrink-0">
                        {item.mockup2D ? (
                          <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
                            <img 
                              src={getImageUrl(item.mockup2D)} 
                              alt={`${item.name} mockup`}
                              className="max-h-full max-w-full object-contain"
                              style={{ objectFit: 'scale-down' }}
                            />
                          </div>
                        ) : item.customDesign ? (
                          <div className="relative w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                            <img 
                              src={getImageUrl(item.customDesign)} 
                              alt={item.name}
                              className="max-w-full max-h-full object-contain"
                            />
                            <div className="absolute inset-0 border border-gray-200 rounded-lg"></div>
                          </div>
                        ) : (
                          <img 
                            src={item.image} 
                            alt={item.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-gray-600 text-sm">{item.phoneName || item.type}</p>
                        {item.caseTypeName && (
                          <p className="text-gray-500 text-xs mt-1">{item.caseTypeName}</p>
                        )}
                        
                        {(item.customDesign || item.mockup2D) && (
                          <div className="mt-2">
                            <Link 
                              to={`/custom-design?designId=${item.designId}`}
                              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              Modify Design
                            </Link>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center space-x-2">
                            <button 
                              className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition disabled:opacity-50"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={isLoading || item.quantity <= 1}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <button 
                              className="w-7 h-7 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition disabled:opacity-50"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              disabled={isLoading}
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center space-x-3">
                            <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
                            <button 
                              className="text-red-500 hover:text-red-600 transition disabled:opacity-50"
                              onClick={() => removeFromCart(item.id)}
                              disabled={isLoading}
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm h-fit">
                <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="text-gray-500 italic">Calculated at checkout</span>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <Link 
                  to="/payment"
                  className={`mt-6 w-full py-4 rounded-full flex items-center justify-center gap-2 ${
                    items.length === 0 || isLoading 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-black text-white hover:bg-gray-800 transition'
                  }`}
                  onClick={(e) => {
                    if (items.length === 0 || isLoading) {
                      e.preventDefault();
                    }
                  }}
                >
                  Proceed to Checkout <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}