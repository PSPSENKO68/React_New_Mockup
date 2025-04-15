import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
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
      <div className="bg-red-50 text-red-500 p-4 rounded-lg">
        {error}
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
      setError(err.message);
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
        <div className="bg-red-50 text-red-500 p-4 rounded-lg">
          {error}
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
      setError(err.message);
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
        <div className="bg-red-50 text-red-500 p-4 rounded-lg">
          {error}
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

  useEffect(() => {
    fetchOrders();
  }, []);

  // Toggle order selection for bulk actions
  const toggleOrderSelection = (orderId: string): void => {
    if (selectedOrderIds.includes(orderId)) {
      setSelectedOrderIds(selectedOrderIds.filter(id => id !== orderId));
    } else {
      setSelectedOrderIds([...selectedOrderIds, orderId]);
    }
  };

  // Toggle select all orders
  const toggleSelectAll = (): void => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(order => order.id));
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
  const handleStatusChange = async (orderId: string, newStatus: string, currentStatus: string): Promise<void> => {
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

  const downloadOrderItemDesigns = async (order: any, item: any): Promise<void> => {
    try {
      if (!item.custom_design_url && !item.mockup_design_url) {
        alert('No designs available for this item');
        return;
      }

      // Create new JSZip instance
      const zip = new JSZip();
      const promises: Promise<void>[] = [];
      
      // Download mockup design if available
      if (item.mockup_design_url) {
        const mockupPromise = downloadFile(item.mockup_design_url)
          .then((fileData: Blob | null) => {
            if (fileData) {
              const fileName = `Order_${order.id.substring(0, 8)}_${item.id.substring(0, 8)}_mockup.png`;
              zip.file(fileName, fileData);
            }
          })
          .catch((err: any) => console.error('Error downloading mockup file:', err));
        
        promises.push(mockupPromise);
      }
      
      // Download custom design if available
      if (item.custom_design_url) {
        const customPromise = downloadFile(item.custom_design_url)
          .then((fileData: Blob | null) => {
            if (fileData) {
              const fileName = `Order_${order.id.substring(0, 8)}_${item.id.substring(0, 8)}_custom.png`;
              zip.file(fileName, fileData);
            }
          })
          .catch((err: any) => console.error('Error downloading custom file:', err));
        
        promises.push(customPromise);
      }
      
      // Wait for all downloads to complete
      await Promise.all(promises);
      
      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Create download link
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      const productName = item.inventory_items?.phone_models?.name 
        ? `${item.inventory_items.phone_models.name}_${item.inventory_items.case_types?.name || 'Case'}`
        : 'product';
      link.download = `design_${productName}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Error downloading item designs:', err);
      setError('Failed to download design. Please try again.');
    }
  };

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
      let filteredOrdersByDate = orders;
      if (dateFilter) {
        const filterDate = new Date(dateFilter);
        filteredOrdersByDate = orders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate.toDateString() === filterDate.toDateString();
        });

        if (filteredOrdersByDate.length === 0) {
          alert('No orders found for the selected date');
          setDownloadLoading(false);
          return;
        }
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

  // Filter orders based on search query
  const filteredOrders = orders.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    return (
      order.id.toLowerCase().includes(searchLower) ||
      order.full_name.toLowerCase().includes(searchLower) ||
      order.email.toLowerCase().includes(searchLower) ||
      order.status.toLowerCase().includes(searchLower)
    );
  });

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
              disabled={downloadLoading || !dateFilter}
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
                  <span>Download by Date</span>
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
        <div className="bg-red-50 text-red-500 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
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
          </div>

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 pl-3">
                      <input 
                        type="checkbox"
                        checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
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
                  {filteredOrders.map(order => (
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
                        <div className="flex items-center gap-2">
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

function AdminUsers() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, email, role, created_at');

      if (error) throw error;
      setAdmins(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      // First create the auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newAdminEmail,
        password: generateTemporaryPassword(), // You should implement this
        email_confirm: true
      });

      if (authError) throw authError;

      // Then add to admin_users table
      const { error: adminError } = await supabase
        .from('admin_users')
        .insert([
          {
            id: authData.user.id,
            email: newAdminEmail,
            role: 'admin'
          }
        ]);

      if (adminError) throw adminError;

      setNewAdminEmail('');
      setShowAddForm(false);
      fetchAdmins();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteAdmin(adminId: string) {
    if (!confirm('Are you sure you want to delete this admin?')) return;

    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', adminId);

      if (error) throw error;
      fetchAdmins();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function generateTemporaryPassword() {
    return Math.random().toString(36).slice(-8);
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
          Add Admin
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Add New Admin</h3>
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
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
              >
                Add Admin
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
                  <th className="text-left py-3">Created At</th>
                  <th className="text-left py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b">
                    <td className="py-3">{admin.email}</td>
                    <td className="py-3">
                      <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                        {admin.role}
                      </span>
                    </td>
                    <td className="py-3">
                      {new Date(admin.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteAdmin(admin.id)}
                          className="p-1 hover:bg-gray-100 rounded text-red-500"
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
      setError(err.message);
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
        <div className="bg-red-50 text-red-500 p-4 rounded-lg">
          {error}
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

export function Admin() {
  const location = useLocation();
  const [currentTab, setCurrentTab] = useState(location.pathname.split('/')[2] || 'dashboard');

  const navigation = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Orders', path: '/admin/orders', icon: ShoppingBag },
    { name: 'Inventory', path: '/admin/inventory', icon: PackageSearch },
    { name: 'Phone Models', path: '/admin/phone-models', icon: Phone },
    { name: 'Case Types', path: '/admin/case-types', icon: PackageSearch },
    { name: 'Admin Users', path: '/admin/admins', icon: Users }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <nav className="space-y-1">
                {navigation.map((item) => {
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
            <Routes>
              <Route path="" element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:orderId" element={<OrderDetail />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="phone-models" element={<PhoneModels />} />
              <Route path="case-types" element={<CaseTypes />} />
              <Route path="admins" element={<AdminUsers />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
}