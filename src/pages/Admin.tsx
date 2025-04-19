import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PackageSearch,
  ShoppingBag,
  Phone,
  Plus,
  Pencil,
  Trash2,
  Search,
  Users,
  Upload,
  Download,
  Loader,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import JSZip from 'jszip';
import { OrderDetail } from '../components/OrderDetail';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState({
    dailyRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    totalOrders: 0,
    pendingOrders: 0,
    averageOrderValue: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      
      // Fetch all orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (ordersError) throw ordersError;
      
      // Calculate metrics
      const orders = ordersData || [];
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Only count delivered orders for revenue
      const deliveredOrders = orders.filter(order => order.status === 'delivered');
      
      const dailyRevenue = deliveredOrders
        .filter(order => new Date(order.created_at) >= startOfDay)
        .reduce((sum, order) => sum + (order.total || 0), 0);
        
      const weeklyRevenue = deliveredOrders
        .filter(order => new Date(order.created_at) >= startOfWeek)
        .reduce((sum, order) => sum + (order.total || 0), 0);
        
      const monthlyRevenue = deliveredOrders
        .filter(order => new Date(order.created_at) >= startOfMonth)
        .reduce((sum, order) => sum + (order.total || 0), 0);
      
      const totalOrders = orders.length;
      
      const pendingOrders = orders.filter(order => 
        order.status === 'pending' || order.status === 'processing'
      ).length;
      
      // Calculate average order value from delivered orders to get accurate metrics
      const averageOrderValue = deliveredOrders.length 
        ? deliveredOrders.reduce((sum, order) => sum + (order.total || 0), 0) / deliveredOrders.length
        : 0;
      
      setDashboardData({
        dailyRevenue,
        weeklyRevenue,
        monthlyRevenue,
        totalOrders,
        pendingOrders,
        averageOrderValue,
      });
      
      // Get recent orders for the table (limit to 5 most recent)
      if (orders.length > 0) {
        const { data: ordersWithItems, error: itemsError } = await supabase
          .from('orders')
          .select(`
            id,
            full_name,
            status,
            total,
            created_at,
            order_items(
              id,
              quantity,
              inventory_items(
                phone_models(name),
                case_types(name)
              )
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (itemsError) throw itemsError;
        setRecentOrders(ordersWithItems || []);
      }
      
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md flex items-center space-x-3 animate-fadeIn">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="font-medium">{error}</span>
        <button 
          onClick={() => setError('')} 
          className="ml-auto text-red-500 hover:text-red-700"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-gray-500 mb-2">Daily Revenue</h3>
          <p className="text-3xl font-bold">{formatCurrency(dashboardData.dailyRevenue)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-gray-500 mb-2">Weekly Revenue</h3>
          <p className="text-3xl font-bold">{formatCurrency(dashboardData.weeklyRevenue)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-gray-500 mb-2">Monthly Revenue</h3>
          <p className="text-3xl font-bold">{formatCurrency(dashboardData.monthlyRevenue)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-gray-500 mb-2">Total Orders</h3>
          <p className="text-3xl font-bold">{dashboardData.totalOrders}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-gray-500 mb-2">Pending Orders</h3>
          <p className="text-3xl font-bold">{dashboardData.pendingOrders}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-gray-500 mb-2">Average Order Value</h3>
          <p className="text-3xl font-bold">{formatCurrency(dashboardData.averageOrderValue)}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="text-xl font-semibold mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3">Order ID</th>
                <th className="text-left py-3">Customer</th>
                <th className="text-left py-3">Product</th>
                <th className="text-left py-3">Status</th>
                <th className="text-left py-3">Total</th>
                <th className="text-left py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length > 0 ? (
                recentOrders.map(order => (
                  <tr key={order.id} className="border-b">
                    <td className="py-3">#{order.id.substring(0, 8)}</td>
                    <td className="py-3">{order.full_name}</td>
                    <td className="py-3">
                      {order.order_items && order.order_items.length > 0 ? (
                        <div>
                          {order.order_items[0].inventory_items?.phone_models?.name} - 
                          {order.order_items[0].inventory_items?.case_types?.name}
                          {order.order_items.length > 1 && ` + ${order.order_items.length - 1} more`}
                        </div>
                      ) : (
                        "No items"
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                        order.status === 'shipping' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3">{formatCurrency(order.total || 0)}</td>
                    <td className="py-3">{new Date(order.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Inventory() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [phoneModels, setPhoneModels] = useState<any[]>([]);
  const [caseTypes, setCaseTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [file2D, setFile2D] = useState<File | null>(null);
  const [file3D, setFile3D] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [formData, setFormData] = useState({
    phoneModelId: '',
    caseTypeId: '',
    quantity: 0,
    reorderPoint: 10
  });

  useEffect(() => {
    fetchInventory();
    fetchPhoneModels();
    fetchCaseTypes();
  }, []);

  async function fetchInventory() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('inventory_items')
        .select(`
          id,
          quantity,
          reorder_point,
          mockup_2d_path,
          mockup_3d_path,
          phone_models(id, name),
          case_types(id, name, price)
        `);

      if (error) throw error;
      setInventory(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPhoneModels() {
    try {
      const { data, error } = await supabase
        .from('phone_models')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setPhoneModels(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function fetchCaseTypes() {
    try {
      const { data, error } = await supabase
        .from('case_types')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCaseTypes(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : parseFloat(value)) : value
    }));
    
    // Reset file uploads when case type changes
    if (name === 'caseTypeId') {
      setFile2D(null);
      setFile3D(null);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, fileType: '2D' | '3D') {
    if (e.target.files && e.target.files.length > 0) {
      if (fileType === '2D') {
        setFile2D(e.target.files[0]);
      } else {
        setFile3D(e.target.files[0]);
      }
    }
  }

  // Helper to check if case type is eligible for file uploads
  function isEligibleForFileUpload(caseTypeId: string): boolean {
    if (!caseTypeId) return false;
    
    const selectedCaseType = caseTypes.find(ct => ct.id === caseTypeId);
    if (!selectedCaseType) return false;
    
    const eligibleTypes = ['Tough', 'Silicone', 'Clear'];
    return eligibleTypes.some(type => selectedCaseType.name.includes(type));
  }

  // Function to get the folder name based on case type
  function getFolderName(caseTypeId: string, fileType: '2D' | '3D'): string | null {
    if (!caseTypeId) return null;
    
    const selectedCaseType = caseTypes.find(ct => ct.id === caseTypeId);
    if (!selectedCaseType) return null;
    
    if (selectedCaseType.name.includes('Tough')) {
      return `phone_mockup/${fileType}/Tough_${fileType}`;
    } else if (selectedCaseType.name.includes('Silicone')) {
      return `phone_mockup/${fileType}/Silicone_${fileType}`;
    } else if (selectedCaseType.name.includes('Clear')) {
      return `phone_mockup/${fileType}/Clear_${fileType}`;
    }
    
    return null;
  }

  async function uploadFile(file: File, path: string): Promise<string | null> {
    try {
      // Get the file extension and name separately to add timestamp
      const originalName = file.name;
      const lastDotIndex = originalName.lastIndexOf('.');
      const fileName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
      const fileExt = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';
      
      // Create timestamp (unix timestamp)
      const timestamp = Date.now();
      
      // Create new filename with timestamp
      const newFileName = `${fileName}_${timestamp}${fileExt}`;
      const filePath = `${path}/${newFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('case-assets')
        .upload(filePath, file, {
          upsert: true // This will overwrite if file exists
        });
        
      if (uploadError) throw uploadError;
      
      return filePath;
    } catch (error: any) {
      console.error('Error uploading file:', error.message);
      return null;
    }
  }

  async function handleAddInventoryItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFileUploading(true);

    try {
      // First upload files if they exist
      let file2DPath = null;
      let file3DPath = null;
      
      if (isEligibleForFileUpload(formData.caseTypeId)) {
        // Upload 2D file if provided
        if (file2D) {
          const folderPath = getFolderName(formData.caseTypeId, '2D');
          if (folderPath) {
            file2DPath = await uploadFile(file2D, folderPath);
            if (!file2DPath) throw new Error('Failed to upload 2D file');
          }
        }
        
        // Upload 3D file if provided
        if (file3D) {
          const folderPath = getFolderName(formData.caseTypeId, '3D');
          if (folderPath) {
            file3DPath = await uploadFile(file3D, folderPath);
            if (!file3DPath) throw new Error('Failed to upload 3D file');
          }
        }
      }
      
      // Then add inventory item
      const { error } = await supabase
        .from('inventory_items')
        .insert([
          {
            phone_model_id: formData.phoneModelId,
            case_type_id: formData.caseTypeId,
            quantity: formData.quantity,
            reorder_point: formData.reorderPoint,
            mockup_2d_path: file2DPath,
            mockup_3d_path: file3DPath
          }
        ]);

      if (error) throw error;

      setFormData({
        phoneModelId: '',
        caseTypeId: '',
        quantity: 0,
        reorderPoint: 10
      });
      setFile2D(null);
      setFile3D(null);
      setShowAddForm(false);
      fetchInventory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFileUploading(false);
    }
  }

  async function handleUpdateInventoryItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFileUploading(true);

    if (!editingItem) return;

    try {
      // Get current item from database to compare file paths
      const { data: currentItem, error: fetchError } = await supabase
        .from('inventory_items')
        .select('mockup_2d_path, mockup_3d_path')
        .eq('id', editingItem.id)
        .single();

      if (fetchError) throw fetchError;

      // Check if files were removed and delete them from storage
      if (currentItem) {
        // If 2D file was removed, delete it from storage
        if (currentItem.mockup_2d_path && !editingItem.file2DPath) {
          const { error: deleteError2D } = await supabase.storage
            .from('case-assets')
            .remove([currentItem.mockup_2d_path]);
          
          if (deleteError2D) {
            console.error('Error deleting 2D file:', deleteError2D);
          }
        }

        // If 3D file was removed, delete it from storage
        if (currentItem.mockup_3d_path && !editingItem.file3DPath) {
          const { error: deleteError3D } = await supabase.storage
            .from('case-assets')
            .remove([currentItem.mockup_3d_path]);
          
          if (deleteError3D) {
            console.error('Error deleting 3D file:', deleteError3D);
          }
        }
      }

      // First upload files if they exist
      let file2DPath = editingItem.file2DPath;
      let file3DPath = editingItem.file3DPath;
      
      if (isEligibleForFileUpload(editingItem.caseTypeId)) {
        // Upload new 2D file if provided
        if (file2D) {
          const folderPath = getFolderName(editingItem.caseTypeId, '2D');
          if (folderPath) {
            file2DPath = await uploadFile(file2D, folderPath);
            if (!file2DPath) throw new Error('Failed to upload 2D file');
          }
        }
        
        // Upload new 3D file if provided
        if (file3D) {
          const folderPath = getFolderName(editingItem.caseTypeId, '3D');
          if (folderPath) {
            file3DPath = await uploadFile(file3D, folderPath);
            if (!file3DPath) throw new Error('Failed to upload 3D file');
          }
        }
      }

      const { error } = await supabase
        .from('inventory_items')
        .update({
          quantity: editingItem.quantity,
          reorder_point: editingItem.reorderPoint,
          mockup_2d_path: file2DPath,
          mockup_3d_path: file3DPath
        })
        .eq('id', editingItem.id);

      if (error) throw error;

      setEditingItem(null);
      setFile2D(null);
      setFile3D(null);
      fetchInventory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFileUploading(false);
    }
  }

  async function handleDeleteInventoryItem(id: string) {
    if (!confirm('Are you sure you want to delete this inventory item?')) return;

    try {
      // First get the inventory item to find file paths
      const { data: itemData, error: fetchError } = await supabase
        .from('inventory_items')
        .select('mockup_2d_path, mockup_3d_path')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Delete files from storage if they exist
      if (itemData) {
        // Delete 2D file if exists
        if (itemData.mockup_2d_path) {
          const { error: deleteError2D } = await supabase.storage
            .from('case-assets')
            .remove([itemData.mockup_2d_path]);
          
          if (deleteError2D) {
            console.error('Error deleting 2D file:', deleteError2D);
          }
        }

        // Delete 3D file if exists
        if (itemData.mockup_3d_path) {
          const { error: deleteError3D } = await supabase.storage
            .from('case-assets')
            .remove([itemData.mockup_3d_path]);
          
          if (deleteError3D) {
            console.error('Error deleting 3D file:', deleteError3D);
          }
        }
      }

      // Then delete the inventory item
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchInventory();
    } catch (err: any) {
      // Check for foreign key constraint violation with order_items
      if (err.message.includes('violates foreign key constraint "order_items_inventory_item_id_fkey"')) {
        setError('Không thể xóa: Sản phẩm này đã tồn tại trong đơn hàng của khách hàng.');
      } else {
        setError(err.message);
      }
    }
  }

  function startEditItem(item: any) {
    setEditingItem({
      id: item.id,
      quantity: item.quantity,
      reorderPoint: item.reorder_point,
      phoneModelId: item.phone_models?.id,
      caseTypeId: item.case_types?.id,
      file2DPath: item.mockup_2d_path,
      file3DPath: item.mockup_3d_path
    });
    setFile2D(null);
    setFile3D(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Inventory</h2>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md flex items-center space-x-3 animate-fadeIn">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">{error}</span>
          <button 
            onClick={() => setError('')} 
            className="ml-auto text-red-500 hover:text-red-700"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Add New Inventory Item</h3>
          <form onSubmit={handleAddInventoryItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Model
              </label>
              <select
                name="phoneModelId"
                value={formData.phoneModelId}
                onChange={handleFormChange}
                className="w-full p-2 border rounded-lg"
                required
              >
                <option value="">Select Phone Model</option>
                {phoneModels.map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Case Type
              </label>
              <select
                name="caseTypeId"
                value={formData.caseTypeId}
                onChange={handleFormChange}
                className="w-full p-2 border rounded-lg"
                required
              >
                <option value="">Select Case Type</option>
                {caseTypes.map(caseType => (
                  <option key={caseType.id} value={caseType.id}>{caseType.name}</option>
                ))}
              </select>
            </div>
            
            {isEligibleForFileUpload(formData.caseTypeId) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    2D File (Optional)
                  </label>
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{file2D ? file2D.name : 'Upload 2D File'}</span>
                      <input
                        type="file"
                        onChange={(e) => handleFileChange(e, '2D')}
                        className="hidden"
                        accept="image/*"
                      />
                    </label>
                    {file2D && (
                      <button
                        type="button"
                        onClick={() => setFile2D(null)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    3D File (Optional)
                  </label>
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{file3D ? file3D.name : 'Upload 3D File'}</span>
                      <input
                        type="file"
                        onChange={(e) => handleFileChange(e, '3D')}
                        className="hidden"
                        accept=".glb,.gltf,.obj,.fbx,.stl"
                      />
                    </label>
                    {file3D && (
                      <button
                        type="button"
                        onClick={() => setFile3D(null)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleFormChange}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    setFormData(prev => ({ ...prev, quantity: 0 }));
                  }
                }}
                className="w-full p-2 border rounded-lg"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Point
              </label>
              <input
                type="number"
                name="reorderPoint"
                value={formData.reorderPoint}
                onChange={handleFormChange}
                onBlur={(e) => {
                  if (e.target.value === '') {
                    setFormData(prev => ({ ...prev, reorderPoint: 0 }));
                  }
                }}
                className="w-full p-2 border rounded-lg"
                required
                min="0"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
                disabled={fileUploading}
              >
                {fileUploading ? 'Uploading...' : 'Add Item'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                disabled={fileUploading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editingItem && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Edit Inventory Item</h3>
          <form onSubmit={handleUpdateInventoryItem} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={editingItem.quantity}
                onChange={(e) => setEditingItem({...editingItem, quantity: parseInt(e.target.value)})}
                className="w-full p-2 border rounded-lg"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Point
              </label>
              <input
                type="number"
                value={editingItem.reorderPoint}
                onChange={(e) => setEditingItem({...editingItem, reorderPoint: parseInt(e.target.value)})}
                className="w-full p-2 border rounded-lg"
                required
                min="0"
              />
            </div>
            
            {isEligibleForFileUpload(editingItem.caseTypeId) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current 2D File
                  </label>
                  {editingItem.file2DPath ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{editingItem.file2DPath.split('/').pop()}</span>
                      <button
                        type="button"
                        onClick={() => setEditingItem({...editingItem, file2DPath: null})}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">No file uploaded</span>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingItem.file2DPath ? 'Replace 2D File (Optional)' : 'Upload 2D File (Optional)'}
                  </label>
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{file2D ? file2D.name : 'Choose File'}</span>
                      <input
                        type="file"
                        onChange={(e) => handleFileChange(e, '2D')}
                        className="hidden"
                        accept="image/*"
                      />
                    </label>
                    {file2D && (
                      <button
                        type="button"
                        onClick={() => setFile2D(null)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current 3D File
                  </label>
                  {editingItem.file3DPath ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{editingItem.file3DPath.split('/').pop()}</span>
                      <button
                        type="button"
                        onClick={() => setEditingItem({...editingItem, file3DPath: null})}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">No file uploaded</span>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {editingItem.file3DPath ? 'Replace 3D File (Optional)' : 'Upload 3D File (Optional)'}
                  </label>
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{file3D ? file3D.name : 'Choose File'}</span>
                      <input
                        type="file"
                        onChange={(e) => handleFileChange(e, '3D')}
                        className="hidden"
                        accept=".glb,.gltf,.obj,.fbx,.stl"
                      />
                    </label>
                    {file3D && (
                      <button
                        type="button"
                        onClick={() => setFile3D(null)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
            
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
                disabled={fileUploading}
              >
                {fileUploading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
                disabled={fileUploading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search inventory..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3">Phone Model</th>
                    <th className="text-left py-3">Case Type</th>
                    <th className="text-left py-3">Quantity</th>
                    <th className="text-left py-3">Reorder Point</th>
                    <th className="text-left py-3">Price</th>
                    <th className="text-left py-3">2D/3D Files</th>
                    <th className="text-left py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory
                    .filter(item => 
                      item.phone_models?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      item.case_types?.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(item => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3">{item.phone_models?.name || '-'}</td>
                      <td className="py-3">{item.case_types?.name || '-'}</td>
                      <td className="py-3">
                        <span className={`font-medium ${item.quantity <= item.reorder_point ? 'text-red-600' : ''}`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="py-3">{item.reorder_point}</td>
                      <td className="py-3">${item.case_types?.price?.toFixed(2) || '0.00'}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          {item.mockup_2d_path && <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">2D</span>}
                          {item.mockup_3d_path && <span className="inline-block px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">3D</span>}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button 
                            className="p-1 hover:bg-gray-100 rounded"
                            onClick={() => startEditItem(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-1 hover:bg-gray-100 rounded text-red-500"
                            onClick={() => handleDeleteInventoryItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhoneModels() {
  const [phoneModels, setPhoneModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingModel, setEditingModel] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPhoneModels();
  }, []);

  async function fetchPhoneModels() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('phone_models')
        .select('*')
        .order('name');

      if (error) throw error;
      setPhoneModels(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddModel(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const { error } = await supabase
        .from('phone_models')
        .insert([
          {
            name: newModelName,
            active: isActive
          }
        ]);

      if (error) throw error;

      setNewModelName('');
      setIsActive(true);
      setShowAddForm(false);
      fetchPhoneModels();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUpdateModel(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!editingModel) return;

    try {
      const { error } = await supabase
        .from('phone_models')
        .update({
          name: editingModel.name,
          active: editingModel.active
        })
        .eq('id', editingModel.id);

      if (error) throw error;

      setEditingModel(null);
      fetchPhoneModels();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    try {
      const { error } = await supabase
        .from('phone_models')
        .update({ active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      fetchPhoneModels();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteModel(id: string) {
    if (!confirm('Are you sure you want to delete this phone model? This will also delete all inventory items associated with this model.')) return;

    try {
      const { error } = await supabase
        .from('phone_models')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchPhoneModels();
    } catch (err: any) {
      // Check for foreign key constraint violation
      if (err.message.includes('violates foreign key constraint') && 
          err.message.includes('order_items_inventory_item_id_fkey')) {
        setError('Không thể xóa: Sản phẩm này đã tồn tại trong đơn hàng của khách hàng.');
      } else {
        setError(err.message);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Phone Models</h2>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Add Model
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md flex items-center space-x-3 animate-fadeIn">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">{error}</span>
          <button 
            onClick={() => setError('')} 
            className="ml-auto text-red-500 hover:text-red-700"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Add New Phone Model</h3>
          <form onSubmit={handleAddModel} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model Name
              </label>
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                className="w-full p-2 border rounded-lg"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
              >
                Add Model
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editingModel && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Edit Phone Model</h3>
          <form onSubmit={handleUpdateModel} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model Name
              </label>
              <input
                type="text"
                value={editingModel.name}
                onChange={(e) => setEditingModel({...editingModel, name: e.target.value})}
                className="w-full p-2 border rounded-lg"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="editIsActive"
                checked={editingModel.active}
                onChange={(e) => setEditingModel({...editingModel, active: e.target.checked})}
                className="rounded"
              />
              <label htmlFor="editIsActive" className="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingModel(null)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search phone models..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3">Model Name</th>
                    <th className="text-left py-3">Status</th>
                    <th className="text-left py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {phoneModels
                    .filter(model => 
                      model.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(model => (
                    <tr key={model.id} className="border-b">
                      <td className="py-3">{model.name}</td>
                      <td className="py-3">
                        <span 
                          className={`px-2 py-1 rounded-full text-xs ${
                            model.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}
                          onClick={() => handleToggleActive(model.id, model.active)}
                          style={{cursor: 'pointer'}}
                        >
                          {model.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button 
                            className="p-1 hover:bg-gray-100 rounded"
                            onClick={() => setEditingModel(model)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-1 hover:bg-gray-100 rounded text-red-500"
                            onClick={() => handleDeleteModel(model.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(10);
  const pageSizeOptions = [5, 10, 20, 50, 100];

  useEffect(() => {
    fetchOrders();
  }, []);

  // Reset to page 1 when changing filters or page size
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter, ordersPerPage]);

  // Toggle order selection for bulk actions
  const toggleOrderSelection = (orderId: string): void => {
    if (selectedOrderIds.includes(orderId)) {
      setSelectedOrderIds(selectedOrderIds.filter(id => id !== orderId));
    } else {
      setSelectedOrderIds([...selectedOrderIds, orderId]);
    }
  };

  // Toggle select all orders (only for current page)
  const toggleSelectAll = (): void => {
    if (selectedOrderIds.length === paginatedOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(paginatedOrders.map(order => order.id));
    }
  };

  // Function to print GHN shipping label
  const printGHNLabel = (orderCode: string): void => {
    // Import GHNService dynamically to avoid any circular dependencies
    import('../lib/ghnService').then(({ default: GHNService }) => {
      // Call the printGHNLabel method directly instead of opening a URL
      GHNService.printGHNLabel(orderCode);
    });
  };

  // Hàm xử lý thay đổi trạng thái đơn hàng
  const _handleStatusChange = async (orderId: string, newStatus: string, currentStatus: string): Promise<void> => {
    if (currentStatus === newStatus) return;
    
    try {
      setError(null);
      
      // Nếu thay đổi từ trạng thái khác sang "completed" (hoàn thành) - không cần cập nhật tồn kho
      // vì tồn kho đã được cập nhật khi tạo đơn hàng
      
      // Nếu thay đổi sang "cancelled" (đã hủy), tăng lại số lượng trong kho
      if (newStatus === 'cancelled' && currentStatus !== 'cancelled') {
        // Import inventoryManager để tăng lại số lượng sản phẩm trong kho
        const { increaseInventoryOnOrderCancellation } = await import('../lib/inventoryManager');
        await increaseInventoryOnOrderCancellation(orderId);
      }
      
      // Nếu đổi từ "cancelled" sang trạng thái khác, giảm số lượng trong kho
      if (currentStatus === 'cancelled' && newStatus !== 'cancelled') {
        // Import inventoryManager để giảm số lượng sản phẩm trong kho
        const { decreaseInventoryOnOrderCreation } = await import('../lib/inventoryManager');
        await decreaseInventoryOnOrderCreation(orderId);
      }
      
      // Cập nhật trạng thái đơn hàng trong cơ sở dữ liệu
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);
      
      if (updateError) throw updateError;
      
      // Cập nhật UI
      const updatedOrders = orders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      );
      setOrders(updatedOrders);
      
    } catch (err: any) {
      console.error('Lỗi khi cập nhật trạng thái đơn hàng:', err);
      setError(err.message || 'Có lỗi xảy ra khi cập nhật trạng thái đơn hàng');
    }
  };
  
  async function fetchOrders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          full_name,
          email,
          status,
          total,
          created_at,
          order_items(
            id,
            quantity,
            custom_design_url,
            mockup_design_url,
            inventory_items(
              phone_models(name),
              case_types(name, price)
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function downloadFile(filePath: string): Promise<Blob | null> {
    try {
      const { data, error } = await supabase.storage
        .from('case-assets')
        .download(filePath);
      
      if (error || !data) {
        console.error('Error downloading file:', error);
        return null;
      }
      
      return data;
    } catch (err: any) {
      console.error('Error in downloadFile:', err);
      return null;
    }
  }

  const downloadSelectedOrderDesigns = async (): Promise<void> => {
    try {
      if (selectedOrderIds.length === 0) {
        alert('Please select at least one order to download designs');
        return;
      }

      setDownloadLoading(true);
      
      // Create new JSZip instance
      const zip = new JSZip();
      const promises: Promise<void>[] = [];
      const selectedOrders = orders.filter(order => selectedOrderIds.includes(order.id));
      
      // Process each selected order
      for (const order of selectedOrders) {
        // Process each item in the order
        for (const item of order.order_items) {
          // Skip items without designs
          if (!item.custom_design_url && !item.mockup_design_url) continue;
          
          // Create folder for each order
          const orderFolder = zip.folder(`Order_${order.id.substring(0, 8)}`);
          if (!orderFolder) continue;
          
          // Download mockup design if available
          if (item.mockup_design_url) {
            const mockupPromise = downloadFile(item.mockup_design_url)
              .then((fileData: Blob | null) => {
                if (fileData && orderFolder) {
                  const productName = item.inventory_items?.phone_models?.name 
                    ? `${item.inventory_items.phone_models.name}_${item.inventory_items.case_types?.name || 'Case'}`
                    : `product_${item.id.substring(0, 8)}`;
                  const fileName = `${productName}_mockup.png`;
                  orderFolder.file(fileName, fileData);
                }
              })
              .catch((err: any) => console.error('Error downloading mockup file:', err));
            
            promises.push(mockupPromise);
          }
          
          // Download custom design if available
          if (item.custom_design_url) {
            const customPromise = downloadFile(item.custom_design_url)
              .then((fileData: Blob | null) => {
                if (fileData && orderFolder) {
                  const productName = item.inventory_items?.phone_models?.name 
                    ? `${item.inventory_items.phone_models.name}_${item.inventory_items.case_types?.name || 'Case'}`
                    : `product_${item.id.substring(0, 8)}`;
                  const fileName = `${productName}_custom.png`;
                  orderFolder.file(fileName, fileData);
                }
              })
              .catch((err: any) => console.error('Error downloading custom file:', err));
            
            promises.push(customPromise);
          }
        }
      }
      
      // Wait for all downloads to complete
      await Promise.all(promises);
      
      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `selected_orders_designs_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Error downloading selected designs:', err);
      setError('Failed to download designs. Please try again.');
    } finally {
      setDownloadLoading(false);
    }
  };

  const downloadAllDesignsByDate = async () => {
    try {
      setDownloadLoading(true);
      setError(null);

      // Filter orders by date if dateFilter is provided
      let filteredOrdersByDate = filteredOrders;
      
      if (filteredOrdersByDate.length === 0) {
        alert('No orders found for the selected filters');
        setDownloadLoading(false);
        return;
      }

      const zip = new JSZip();
      const promises: Promise<void>[] = [];

      // Group designs by order
      for (const order of filteredOrdersByDate) {
        const orderFolder = zip.folder(`Order_${order.id.substring(0, 8)}_${order.full_name}`);
        if (!orderFolder) continue;

        for (const item of order.order_items) {
          if (item.custom_design_url) {
            const promise = downloadFile(item.custom_design_url)
              .then((fileData: Blob | null) => {
                if (fileData && orderFolder) {
                  const fileName = `item_${item.id.substring(0, 8)}_custom.png`;
                  orderFolder.file(fileName, fileData);
                }
              })
              .catch((err: any) => console.error('Download error:', err));
            promises.push(promise);
          }

          if (item.mockup_design_url) {
            const promise = downloadFile(item.mockup_design_url)
              .then((fileData: Blob | null) => {
                if (fileData && orderFolder) {
                  const fileName = `item_${item.id.substring(0, 8)}_mockup.png`;
                  orderFolder.file(fileName, fileData);
                }
              })
              .catch((err: any) => console.error('Download error:', err));
            promises.push(promise);
          }
        }
      }

      await Promise.all(promises);
      const content = await zip.generateAsync({ type: 'blob' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      const dateString = dateFilter ? new Date(dateFilter).toISOString().split('T')[0] : 'all';
      link.download = `designs_${dateString}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error(err);
      setError('Failed to download designs');
    } finally {
      setDownloadLoading(false);
    }
  };

  // Filter orders based on search query and date filter
  const filteredOrders = orders.filter(order => {
    // Skip null or undefined orders
    if (!order) return false;
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (order.id?.toLowerCase() || '').includes(searchLower) ||
      (order.full_name?.toLowerCase() || '').includes(searchLower) ||
      (order.email?.toLowerCase() || '').includes(searchLower) ||
      (order.status?.toLowerCase() || '').includes(searchLower);
    
    // Apply date filter if set
    if (dateFilter) {
      // Skip if order doesn't have a created_at date
      if (!order.created_at) return false;
      
      const filterDate = new Date(dateFilter);
      filterDate.setHours(0, 0, 0, 0);
      
      const orderDate = new Date(order.created_at);
      orderDate.setHours(0, 0, 0, 0);
      
      return matchesSearch && orderDate.getTime() === filterDate.getTime();
    }
    
    return matchesSearch;
  });

  // Calculate pagination
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const paginatedOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

  // Add a function to handle order cancellation with GHN
  const handleCancelGHNOrder = async (orderId: string): Promise<void> => {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn hàng này? Đơn hàng sẽ bị hủy trên GHN và không thể khôi phục.')) {
      return;
    }
    
    try {
      setError(null);
      
      // Import GHNService and inventoryManager dynamically to handle the cancellation
      const GHNService = (await import('../lib/ghnService')).default;
      const { increaseInventoryOnOrderCancellation } = await import('../lib/inventoryManager');
      
      // First cancel the order on GHN
      const result = await GHNService.markOrderAsCancelled(orderId);
      
      if (!result.success) {
        throw new Error(result.message || 'Không thể hủy đơn hàng trên GHN');
      }
      
      // Restore inventory after cancellation
      await increaseInventoryOnOrderCancellation(orderId);
      
      // Update local orders data with the new status
      const updatedOrders = orders.map(order => 
        order.id === orderId ? { ...order, status: 'cancelled' } : order
      );
      setOrders(updatedOrders);
      
      alert('Đã hủy đơn hàng thành công');
      
    } catch (err: any) {
      console.error('Lỗi khi hủy đơn hàng:', err);
      setError(`Có lỗi xảy ra khi hủy đơn hàng: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-2xl font-bold">Orders</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            />
            <button
              onClick={downloadAllDesignsByDate}
              disabled={downloadLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {downloadLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Designs</span>
                </>
              )}
            </button>
          </div>
          
          <button
            onClick={downloadSelectedOrderDesigns}
            disabled={downloadLoading || selectedOrderIds.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
          >
            {downloadLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Selected ({selectedOrderIds.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md flex items-center space-x-3 animate-fadeIn">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">{error}</span>
          <button 
            onClick={() => setError('')} 
            className="ml-auto text-red-500 hover:text-red-700"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Records per page:</span>
              <select
                className="border rounded-lg px-2 py-1"
                value={ordersPerPage}
                onChange={(e) => setOrdersPerPage(Number(e.target.value))}
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 pl-3">
                        <input 
                          type="checkbox"
                          checked={paginatedOrders.length > 0 && selectedOrderIds.length === paginatedOrders.length}
                          onChange={toggleSelectAll}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="text-left py-3">Order ID</th>
                      <th className="text-left py-3">Customer</th>
                      <th className="text-left py-3">Items</th>
                      <th className="text-left py-3">Status</th>
                      <th className="text-left py-3">Total</th>
                      <th className="text-left py-3">Date</th>
                      <th className="text-right py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.length > 0 ? (
                      paginatedOrders.map(order => (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 pl-4">
                            <input 
                              type="checkbox"
                              checked={selectedOrderIds.includes(order.id)}
                              onChange={() => toggleOrderSelection(order.id)} 
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="py-3">
                            <span>{order.id.substring(0, 8)}</span>
                          </td>
                          <td className="py-3">{order.full_name}</td>
                          <td className="py-3">
                            {order.order_items?.map((item: any) => (
                              <div key={item.id} className="text-sm flex items-center gap-2 mb-1">
                                <span>
                                  {item.inventory_items?.phone_models?.name} - {item.inventory_items?.case_types?.name}
                                  <span className="text-gray-500"> (x{item.quantity})</span>
                                </span>
                              </div>
                            ))}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              order.status === 'completed' ? 'bg-green-100 text-green-800' :
                              order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="py-3">${order.total.toFixed(2)}</td>
                          <td className="py-3">{new Date(order.created_at).toLocaleString()}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2 justify-end">
                              <Link 
                                to={`/admin/orders/${order.id}`}
                                className="p-1 hover:bg-gray-100 rounded text-blue-600"
                                title="View order details"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              
                              {order.has_ghn_order && order.ghn_code && (
                                <>
                                  <button
                                    onClick={() => printGHNLabel(order.ghn_code)}
                                    className="p-1 hover:bg-gray-100 rounded text-green-600"
                                    title="In vận đơn"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                      <rect x="6" y="14" width="12" height="8"></rect>
                                    </svg>
                                  </button>
                                  
                                  {order.status !== 'cancelled' && (
                                    <button
                                      onClick={() => handleCancelGHNOrder(order.id)}
                                      className="p-1 hover:bg-gray-100 rounded text-red-600"
                                      title="Hủy đơn vận chuyển"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <line x1="15" y1="9" x2="9" y2="15"></line>
                                        <line x1="9" y1="9" x2="15" y2="15"></line>
                                      </svg>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-gray-500">
                          No orders found matching the current filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {filteredOrders.length > 0 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-500">
                    Showing {indexOfFirstOrder + 1}-{Math.min(indexOfLastOrder, filteredOrders.length)} of {filteredOrders.length} orders
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    {/* Page numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = i + 1;
                        
                        // If more than 5 pages and we're not at the start
                        if (totalPages > 5 && currentPage > 3) {
                          pageNum = currentPage - 3 + i;
                        }
                        
                        // Make sure we don't exceed totalPages
                        if (pageNum > totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 flex items-center justify-center rounded-md ${
                              currentPage === pageNum 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white text-gray-700 border hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <span className="mx-1">...</span>
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-8 h-8 flex items-center justify-center rounded-md border bg-white text-gray-700 hover:bg-gray-50"
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminUsers() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('admin');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'orders', 'inventory', 'phone_models', 'case_types'
  ]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [currentEditUser, setCurrentEditUser] = useState<any>(null);
  const [currentEditPermissions, setCurrentEditPermissions] = useState<string[]>([]);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const availablePermissions = [
    { id: 'orders', label: 'Orders' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'phone_models', label: 'Phone Models' },
    { id: 'case_types', label: 'Case Types' }
  ];

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, email, role, created_at, permissions, is_active');

      if (error) throw error;
      setAdmins(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value;
    setNewUserRole(role);
    
    // If role is admin, select all permissions automatically
    if (role === 'admin') {
      setSelectedPermissions(['orders', 'inventory', 'phone_models', 'case_types']);
    } else {
      setSelectedPermissions([]);
    }
  }

  function handlePermissionChange(permissionId: string) {
    setSelectedPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(p => p !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  }

  function handleEditPermissionChange(permissionId: string) {
    setCurrentEditPermissions(prev => {
      if (prev.includes(permissionId)) {
        return prev.filter(p => p !== permissionId);
      } else {
        return [...prev, permissionId];
      }
    });
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      // Kiểm tra xem email đã tồn tại trong hệ thống chưa
      const { data: existingAdmins, error: checkError } = await supabase
        .from('admin_users')
        .select('id, email, is_active')
        .ilike('email', newAdminEmail);
      
      if (checkError) throw checkError;
      
      // Nếu email đã tồn tại và đã bị xóa khỏi admin_users
      // nhưng có thể vẫn còn trong auth.users
      if (existingAdmins && existingAdmins.length > 0) {
        throw new Error(`Email ${newAdminEmail} đã tồn tại trong hệ thống. Vui lòng sử dụng email khác hoặc liên hệ quản trị viên để kích hoạt lại.`);
      }

      // Generate a temporary password
      const tempPassword = generateTemporaryPassword();
      
      // Use the standard sign up method instead of admin API
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: tempPassword,
        options: {
          emailRedirectTo: window.location.origin + '/admin/login'
        }
      });

      if (authError) {
        // Nếu lỗi là do email đã tồn tại trong auth.users
        if (authError.message?.includes('User already registered')) {
          throw new Error(`Email ${newAdminEmail} đã tồn tại trong hệ thống xác thực. Vui lòng sử dụng email khác.`);
        }
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      // Then add to admin_users table with role and permissions
      const { error: adminError } = await supabase
        .from('admin_users')
        .insert([
          {
            id: authData.user.id,
            email: newAdminEmail,
            role: newUserRole,
            permissions: newUserRole === 'admin' ? 
              ['orders', 'inventory', 'phone_models', 'case_types'] : 
              selectedPermissions
          }
        ]);

      if (adminError) {
        if (adminError.message?.includes('row-level security')) {
          throw new Error(
            'Row-level security policy error. Please use the "Fix Admin RLS Policy" button on the Diagnostic page first.'
          );
        }
        
        // Nếu lỗi liên quan đến foreign key - có thể user đã tồn tại trong auth.users 
        // nhưng không có trong admin_users
        if (adminError.message?.includes('violates foreign key constraint')) {
          throw new Error(
            `Không thể tạo tài khoản. User ID đã tồn tại nhưng không có quyền admin. Vui lòng sử dụng email khác.`
          );
        }
        
        throw adminError;
      }

      // Display temporary password to admin
      alert(`${newUserRole === 'admin' ? 'Admin' : 'Staff'} user created! Temporary password: ${tempPassword}\n\nPlease save this password and share it with the new user.`);

      setNewAdminEmail('');
      setNewUserRole('admin');
      setSelectedPermissions(['orders', 'inventory', 'phone_models', 'case_types']);
      setShowAddForm(false);
      fetchAdmins();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteAdmin(adminId: string) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      // First check if the user is not the currently authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && user.id === adminId) {
        setError('You cannot delete your own account.');
        return;
      }

      // Try to delete from auth.users first
      const { error: authError } = await supabase.rpc('delete_admin_user', { user_id: adminId });

      if (authError) {
        // Fall back to just deleting from admin_users if delete_admin_user function doesn't exist
        const { error } = await supabase
          .from('admin_users')
          .delete()
          .eq('id', adminId);

        if (error) throw error;
      }
      
      fetchAdmins();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleToggleActive(adminId: string, currentStatus: boolean) {
    try {
      // Check if trying to deactivate own account
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user && user.id === adminId) {
        setError('You cannot deactivate your own account.');
        return;
      }
      
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: !currentStatus })
        .eq('id', adminId);

      if (error) throw error;
      fetchAdmins();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUpdatePermissions() {
    if (!currentEditUser) return;
    
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ permissions: currentEditPermissions })
        .eq('id', currentEditUser.id);

      if (error) throw error;
      
      setShowPermissionModal(false);
      setCurrentEditUser(null);
      setCurrentEditPermissions([]);
      fetchAdmins();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    try {
      if (!currentEditUser) return;
      
      // Update the user's password in Auth
      const { error } = await supabase.rpc('admin_update_user_password', { 
        user_id: currentEditUser.id,
        new_password: newPassword
      });
      
      if (error) throw error;
      
      alert('Password updated successfully');
      setShowPasswordChangeModal(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setCurrentEditUser(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function generateTemporaryPassword() {
    // Generate a more secure password with letters, numbers, and special characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Generate at least 10 characters
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Admin Users</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md flex items-center space-x-3 animate-fadeIn">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">{error}</span>
          <button 
            onClick={() => setError('')} 
            className="ml-auto text-red-500 hover:text-red-700"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Add New User</h3>
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="w-full p-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={newUserRole}
                onChange={handleRoleChange}
                className="w-full p-2 border rounded-lg"
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            
            {newUserRole === 'staff' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Permissions
                </label>
                <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                  {availablePermissions.map(permission => (
                    <label key={permission.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(permission.id)}
                        onChange={() => handlePermissionChange(permission.id)}
                        className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      {permission.label}
                    </label>
                  ))}
                </div>
                {selectedPermissions.length === 0 && (
                  <p className="text-red-500 text-sm mt-1">Please select at least one permission</p>
                )}
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={newUserRole === 'staff' && selectedPermissions.length === 0}
                className={`px-4 py-2 rounded-lg ${
                  newUserRole === 'staff' && selectedPermissions.length === 0 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                Add User
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Email</th>
                  <th className="text-left py-3">Role</th>
                  <th className="text-left py-3">Status</th>
                  <th className="text-left py-3">Permissions</th>
                  <th className="text-left py-3">Created At</th>
                  <th className="text-left py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b">
                    <td className="py-3">{admin.email}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        admin.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {admin.role}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        admin.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3">
                      {admin.role === 'admin' ? (
                        <span className="text-xs">All permissions</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(admin.permissions) && admin.permissions.map((perm: string) => (
                            <span key={perm} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                              {availablePermissions.find(p => p.id === perm)?.label || perm}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      {new Date(admin.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        {admin.role === 'staff' && (
                          <button
                            onClick={() => {
                              setCurrentEditUser(admin);
                              setCurrentEditPermissions(Array.isArray(admin.permissions) ? [...admin.permissions] : []);
                              setShowPermissionModal(true);
                            }}
                            className="p-1 hover:bg-gray-100 rounded text-blue-500"
                            title="Edit Permissions"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setCurrentEditUser(admin);
                            setShowPasswordChangeModal(true);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500"
                          title="Change Password"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleToggleActive(admin.id, admin.is_active)}
                          className={`p-1 hover:bg-gray-100 rounded ${
                            admin.is_active ? 'text-red-500' : 'text-green-500'
                          }`}
                          title={admin.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {admin.is_active ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteAdmin(admin.id)}
                          className="p-1 hover:bg-gray-100 rounded text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Permission Edit Modal */}
      {showPermissionModal && currentEditUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Edit Permissions for {currentEditUser.email}</h3>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <div className="grid grid-cols-2 gap-3">
                {availablePermissions.map(permission => (
                  <label key={permission.id} className="flex items-center bg-white p-3 rounded border hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentEditPermissions.includes(permission.id)}
                      onChange={() => handleEditPermissionChange(permission.id)}
                      className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium">{permission.label}</div>
                      <div className="text-xs text-gray-500">
                        {permission.id === 'orders' && 'Manage customer orders'}
                        {permission.id === 'inventory' && 'Manage product inventory'}
                        {permission.id === 'phone_models' && 'Manage phone models'}
                        {permission.id === 'case_types' && 'Manage case types'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              
              {currentEditPermissions.length === 0 && (
                <p className="text-red-500 text-sm mt-3">Please select at least one permission</p>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowPermissionModal(false);
                  setCurrentEditUser(null);
                  setCurrentEditPermissions([]);
                }}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePermissions}
                disabled={currentEditPermissions.length === 0}
                className={`px-4 py-2 rounded-lg ${
                  currentEditPermissions.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-black text-white hover:bg-gray-800'
                }`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordChangeModal && currentEditUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Change Password for {currentEditUser.email}</h3>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  minLength={6}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  minLength={6}
                  required
                />
                {newPassword !== confirmNewPassword && confirmNewPassword && (
                  <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                )}
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChangeModal(false);
                    setCurrentEditUser(null);
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPassword || !confirmNewPassword || newPassword !== confirmNewPassword}
                  className={`px-4 py-2 rounded-lg ${
                    !newPassword || !confirmNewPassword || newPassword !== confirmNewPassword
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-gray-800'
                  }`}
                >
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CaseTypes() {
  const [caseTypes, setCaseTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCaseType, setEditingCaseType] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0
  });

  useEffect(() => {
    fetchCaseTypes();
  }, []);

  async function fetchCaseTypes() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('case_types')
        .select('*')
        .order('name');

      if (error) throw error;
      setCaseTypes(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleAddCaseType(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const { error } = await supabase
        .from('case_types')
        .insert([formData]);

      if (error) throw error;

      setFormData({ name: '', description: '', price: 0 });
      setShowAddForm(false);
      fetchCaseTypes();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleUpdateCaseType(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!editingCaseType) return;

    try {
      const { error } = await supabase
        .from('case_types')
        .update({
          name: editingCaseType.name,
          description: editingCaseType.description,
          price: editingCaseType.price
        })
        .eq('id', editingCaseType.id);

      if (error) throw error;

      setEditingCaseType(null);
      fetchCaseTypes();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteCaseType(id: string) {
    if (!confirm('Are you sure you want to delete this case type? This will also delete all inventory items associated with this type.')) return;

    try {
      const { error } = await supabase
        .from('case_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchCaseTypes();
    } catch (err: any) {
      // Check for foreign key constraint violation
      if (err.message.includes('violates foreign key constraint') && 
          err.message.includes('order_items_inventory_item_id_fkey')) {
        setError('Không thể xóa: Sản phẩm này đã tồn tại trong đơn hàng của khách hàng.');
      } else {
        setError(err.message);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Case Types</h2>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Add Case Type
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md flex items-center space-x-3 animate-fadeIn">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">{error}</span>
          <button 
            onClick={() => setError('')} 
            className="ml-auto text-red-500 hover:text-red-700"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Add New Case Type</h3>
          <form onSubmit={handleAddCaseType} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                className="w-full p-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                className="w-full p-2 border rounded-lg"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price ($)
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleFormChange}
                className="w-full p-2 border rounded-lg"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
              >
                Add Case Type
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editingCaseType && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Edit Case Type</h3>
          <form onSubmit={handleUpdateCaseType} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={editingCaseType.name}
                onChange={(e) => setEditingCaseType({...editingCaseType, name: e.target.value})}
                className="w-full p-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={editingCaseType.description || ''}
                onChange={(e) => setEditingCaseType({...editingCaseType, description: e.target.value})}
                className="w-full p-2 border rounded-lg"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price ($)
              </label>
              <input
                type="number"
                value={editingCaseType.price}
                onChange={(e) => setEditingCaseType({...editingCaseType, price: parseFloat(e.target.value)})}
                className="w-full p-2 border rounded-lg"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingCaseType(null)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search case types..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3">Name</th>
                    <th className="text-left py-3">Description</th>
                    <th className="text-left py-3">Price</th>
                    <th className="text-left py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {caseTypes
                    .filter(caseType => 
                      caseType.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      caseType.description?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(caseType => (
                    <tr key={caseType.id} className="border-b">
                      <td className="py-3 font-medium">{caseType.name}</td>
                      <td className="py-3 text-gray-600">{caseType.description || '-'}</td>
                      <td className="py-3">${caseType.price.toFixed(2)}</td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button 
                            className="p-1 hover:bg-gray-100 rounded"
                            onClick={() => setEditingCaseType(caseType)}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            className="p-1 hover:bg-gray-100 rounded text-red-500"
                            onClick={() => handleDeleteCaseType(caseType.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
      <p className="text-gray-600 mb-6">
        You do not have permission to access this section.
      </p>
    </div>
  );
}

function AdminWelcome() {
  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold mb-4">Chào mừng đến với Trang Quản Trị</h2>
      <p className="text-gray-600 mb-6">
        Vui lòng chọn một mục từ menu để bắt đầu làm việc.
      </p>
      <div className="mt-8 p-4 bg-yellow-50 rounded-lg text-yellow-800">
        <p>Lưu ý: Bạn chỉ thấy các menu mà bạn có quyền truy cập.</p>
      </div>
    </div>
  );
}

export function Admin() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Fetch admin info
          const { data, error } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', user.id)
            .single();
            
          if (error) {
            console.error('Error fetching admin info:', error);
            return;
          }
          
          setCurrentUser(data);
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCurrentUser();
  }, []);
  
  // Check if user has permission for a specific section
  const hasPermission = (section: string): boolean => {
    if (!currentUser) return false;
    
    // Admin role has access to everything
    if (currentUser.role === 'admin') {
      return true;
    }
    
    // Staff role with permissions
    if (currentUser.role === 'staff' && currentUser.is_active) {
      // For staff, check the permissions array
      return Array.isArray(currentUser.permissions) && 
        currentUser.permissions.includes(section);
    }
    
    return false;
  };

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }
    
    try {
      // Sử dụng Supabase Auth API để thay đổi mật khẩu
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      // Clear form and close modal
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordModal(false);
      
      alert('Password updated successfully');
    } catch (err: any) {
      setPasswordError(err.message);
    }
  }

  // Define navigation based on permissions
  const navigation = [
    ...(hasPermission('orders') ? [{ name: 'Dashboard', path: '/admin', icon: LayoutDashboard, requiredRole: 'admin' }] : []),
    ...(hasPermission('orders') ? [{ name: 'Orders', path: '/admin/orders', icon: ShoppingBag }] : []),
    ...(hasPermission('inventory') ? [{ name: 'Inventory', path: '/admin/inventory', icon: PackageSearch }] : []),
    ...(hasPermission('phone_models') ? [{ name: 'Phone Models', path: '/admin/phone-models', icon: Phone }] : []),
    ...(hasPermission('case_types') ? [{ name: 'Case Types', path: '/admin/case-types', icon: PackageSearch }] : []),
    ...(hasPermission('orders') ? [{ name: 'Admin Users', path: '/admin/admins', icon: Users, requiredRole: 'admin' }] : [])
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="animate-spin h-10 w-10 text-black" />
      </div>
    );
  }

  // If user doesn't have any permissions, show an error message
  if (!loading && (!currentUser || !currentUser.is_active || 
     (currentUser.role === 'staff' && 
      (!Array.isArray(currentUser.permissions) || currentUser.permissions.length === 0)))) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-sm max-w-md w-full text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            {!currentUser.is_active 
              ? 'Your account has been deactivated. Please contact an administrator.'
              : 'You do not have permission to access the admin panel.'}
          </p>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/admin/login';
            }}
            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Filter visible routes based on user role
  const visibleNavigation = navigation.filter(item => 
    !item.requiredRole || item.requiredRole === currentUser?.role
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
              <div className="text-sm text-gray-500 mb-2">Logged in as:</div>
              <div className="font-medium mb-1">{currentUser?.email}</div>
              <div className="text-xs mb-4">
                <span className={`inline-block px-2 py-0.5 rounded-full ${
                  currentUser?.role === 'admin' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {currentUser?.role}
                </span>
              </div>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="w-full text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
                >
                  Change Password
                </button>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = '/admin/login';
                  }}
                  className="w-full text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <nav className="space-y-1">
                {visibleNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                        isActive
                          ? 'bg-black text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <Routes>
                <Route index element={
                  currentUser?.role === 'admin' ? <Dashboard /> : 
                  hasPermission('orders') ? <Orders /> :
                  hasPermission('inventory') ? <Inventory /> :
                  hasPermission('phone_models') ? <PhoneModels /> :
                  hasPermission('case_types') ? <CaseTypes /> :
                  <AdminWelcome />
                } />
                <Route path="orders" element={hasPermission('orders') ? <Orders /> : <AccessDenied />} />
                <Route path="orders/:orderId" element={hasPermission('orders') ? <OrderDetail /> : <AccessDenied />} />
                <Route path="inventory" element={hasPermission('inventory') ? <Inventory /> : <AccessDenied />} />
                <Route path="phone-models" element={hasPermission('phone_models') ? <PhoneModels /> : <AccessDenied />} />
                <Route path="case-types" element={hasPermission('case_types') ? <CaseTypes /> : <AccessDenied />} />
                <Route path="admins" element={currentUser?.role === 'admin' ? <AdminUsers /> : <AccessDenied />} />
              </Routes>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Change Your Password</h3>
            
            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
                {passwordError}
              </div>
            )}
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  minLength={6}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                  minLength={6}
                  required
                />
                {newPassword !== confirmPassword && confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                )}
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError(null);
                  }}
                  className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className={`px-4 py-2 rounded-lg ${
                    !newPassword || !confirmPassword || newPassword !== confirmPassword
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-gray-800'
                  }`}
                >
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}