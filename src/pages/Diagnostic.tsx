import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function Diagnostic() {
  const [supabaseInfo, setSupabaseInfo] = useState<{ url?: string, key?: string }>({});
  const [routeInfo, setRouteInfo] = useState<{ pathname: string, search: string }>({ 
    pathname: window.location.pathname, 
    search: window.location.search 
  });
  const [connectionStatus, setConnectionStatus] = useState<{
    status: 'unknown' | 'testing' | 'success' | 'error',
    message?: string
  }>({ status: 'unknown' });
  
  useEffect(() => {
    // Check if Supabase environment variables are configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    setSupabaseInfo({
      url: supabaseUrl ? 'Configured ✓' : 'Missing ✗',
      key: supabaseKey ? 'Configured ✓' : 'Missing ✗'
    });
    
    // Update route info on navigation
    const updateRouteInfo = () => {
      setRouteInfo({
        pathname: window.location.pathname,
        search: window.location.search
      });
    };
    
    window.addEventListener('popstate', updateRouteInfo);
    return () => window.removeEventListener('popstate', updateRouteInfo);
  }, []);
  
  const testConnection = async () => {
    setConnectionStatus({ status: 'testing' });
    try {
      // Test all three tables
      const tables = [
        { name: 'phone_models', label: 'Phone Models' },
        { name: 'case_types', label: 'Case Types' },
        { name: 'inventory_items', label: 'Inventory Items' }
      ];
      
      let results = [];
      
      for (const table of tables) {
        const { data, error } = await supabase
          .from(table.name)
          .select('count')
          .limit(1);
          
        results.push({
          table: table.label,
          status: error ? '❌' : '✅',
          error: error ? error.message : null
        });
      }
      
      const anyErrors = results.some(r => r.status === '❌');
      
      if (anyErrors) {
        const errorDetails = results
          .filter(r => r.status === '❌')
          .map(r => `${r.table}: ${r.error}`)
          .join(', ');
          
        setConnectionStatus({ 
          status: 'error', 
          message: `Connection issues with: ${errorDetails}` 
        });
      } else {
        setConnectionStatus({ 
          status: 'success', 
          message: 'Connection successful to all tables! ✅' 
        });
      }
    } catch (err: any) {
      console.error('Unexpected connection error:', err);
      setConnectionStatus({ 
        status: 'error', 
        message: `Unexpected error: ${err.message || JSON.stringify(err)}` 
      });
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus.status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'testing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-sm">
          <h1 className="text-3xl font-bold mb-6">System Diagnostic</h1>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Current Route</h2>
            <div className="bg-gray-100 p-4 rounded">
              <p><strong>Path:</strong> {routeInfo.pathname}</p>
              <p><strong>Query:</strong> {routeInfo.search || '(none)'}</p>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Supabase Configuration</h2>
            <div className="bg-gray-100 p-4 rounded mb-4">
              <p><strong>URL:</strong> {supabaseInfo.url}</p>
              <p><strong>API Key:</strong> {supabaseInfo.key}</p>
              <p className="text-sm text-gray-500 mt-2">
                If either of these shows as "Missing ✗", you need to create a .env file in your project
                root with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values.
              </p>
            </div>
            
            <button 
              onClick={testConnection}
              disabled={connectionStatus.status === 'testing'}
              className={`px-4 py-2 rounded-lg ${
                connectionStatus.status === 'testing' 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              {connectionStatus.status === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            
            {connectionStatus.status !== 'unknown' && (
              <div className={`mt-4 p-3 rounded-lg ${getConnectionStatusColor()}`}>
                {connectionStatus.message}
              </div>
            )}
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Quick Navigation</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Link 
                to="/" 
                className="bg-black text-white px-4 py-2 rounded-lg text-center hover:bg-gray-800"
              >
                Home
              </Link>
              <Link 
                to="/custom-design" 
                className="bg-black text-white px-4 py-2 rounded-lg text-center hover:bg-gray-800"
              >
                Custom Design
              </Link>
              <Link 
                to="/cart" 
                className="bg-black text-white px-4 py-2 rounded-lg text-center hover:bg-gray-800"
              >
                Cart
              </Link>
              <Link 
                to="/admin" 
                className="bg-black text-white px-4 py-2 rounded-lg text-center hover:bg-gray-800"
              >
                Admin
              </Link>
              <Link 
                to="/admin/login" 
                className="bg-black text-white px-4 py-2 rounded-lg text-center hover:bg-gray-800"
              >
                Admin Login
              </Link>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Admin Tools</h2>
            <div className="bg-yellow-50 p-4 rounded-lg mb-4">
              <p className="text-yellow-700 mb-2">
                <strong>Warning:</strong> These tools modify database settings directly.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  // Execute raw SQL to add the RLS policy
                  const { error } = await supabase.rpc('add_admin_rls_policy');
                  
                  if (error) {
                    alert(`Error: ${error.message}`);
                  } else {
                    alert('Admin RLS policy added successfully!');
                  }
                } catch (err) {
                  console.error('Error adding policy:', err);
                  alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Fix Admin RLS Policy
            </button>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">Application Info</h2>
            <div className="bg-gray-100 p-4 rounded">
              <p><strong>Environment:</strong> {import.meta.env.MODE}</p>
              <p><strong>Base URL:</strong> {import.meta.env.BASE_URL}</p>
              <p><strong>Browser:</strong> {navigator.userAgent}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 