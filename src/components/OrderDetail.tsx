import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Camera, Upload, TruckIcon, CheckCircle, X, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import GHNService from '../lib/ghnService';

interface OrderDetail {
  id: string;
  full_name: string;
  shipping_address: string;
  phone_number: string;
  email?: string;
  payment_method: string;
  payment_status: string;
  shipping_fee: number;
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
  proof_image_url?: string;
  has_ghn_order: boolean;
  ghn_code?: string;
  notes?: string;
}

interface OrderItem {
  id: string;
  custom_design_url?: string;
  mockup_design_url?: string;
  quantity: number;
  price: number;
  product_name?: string;
  inventory_items?: {
    phone_models?: {
      name: string;
    };
    case_types?: {
      name: string;
    };
  };
}

export function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  
  const [loadingProof, setLoadingProof] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [creatingGHN, setCreatingGHN] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    fetchOrderDetails();
    return () => {
      // Clean up camera stream when component unmounts
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [orderId]);

  // Load public URLs for stored images when order items change
  useEffect(() => {
    loadImageUrls();
  }, [orderItems, order]);

  async function loadImageUrls() {
    if (orderItems.length === 0) return;
    
    const urlMap: Record<string, string> = {};
    
    // Load proof image if available
    if (order?.proof_image_url) {
      try {
        const { data } = supabase.storage
          .from('case-assets')
          .getPublicUrl(order.proof_image_url);
        
        if (data.publicUrl) {
          urlMap[order.proof_image_url] = data.publicUrl;
          setProofPreview(data.publicUrl);
        }
      } catch (error) {
        console.error('Error getting public URL for proof image:', error);
      }
    }
    
    // Load item images
    for (const item of orderItems) {
      // Process mockup_design_url paths
      if (item.mockup_design_url) {
        try {
          const { data } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.mockup_design_url);
          
          if (data.publicUrl) {
            urlMap[item.mockup_design_url] = data.publicUrl;
          }
        } catch (error) {
          console.error('Error getting public URL for mockup design:', error);
        }
      }
      
      // Process custom_design_url paths
      if (item.custom_design_url) {
        try {
          const { data } = supabase.storage
            .from('case-assets')
            .getPublicUrl(item.custom_design_url);
          
          if (data.publicUrl) {
            urlMap[item.custom_design_url] = data.publicUrl;
          }
        } catch (error) {
          console.error('Error getting public URL for custom design:', error);
        }
      }
    }
    
    setImageUrls(urlMap);
  }

  // Helper function to get the correct image URL
  const getImageUrl = (path: string | undefined): string | undefined => {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    if (path.startsWith('data:')) return path;
    
    // Use the url from imageUrls if available
    if (imageUrls[path]) return imageUrls[path];
    
    // Return a placeholder if image not found
    return undefined;
  };

  async function fetchOrderDetails() {
    try {
      setLoading(true);
      
      if (!orderId) {
        setError('Order ID not found');
        return;
      }

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderError) {
        throw orderError;
      }

      setOrder(orderData as OrderDetail);

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          quantity,
          price,
          custom_design_url,
          mockup_design_url,
          inventory_items(
            id,
            phone_models(name),
            case_types(name)
          )
        `)
        .eq('order_id', orderId);

      if (itemsError) {
        throw itemsError;
      }

      setOrderItems(itemsData as OrderItem[]);
    } catch (error: any) {
      console.error('Error fetching order details:', error);
      setError(error.message || 'Error loading order details');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofImage(file);
      
      // Create a preview URL
      const previewUrl = URL.createObjectURL(file);
      setProofPreview(previewUrl);
      
      // Hide camera if it was open
      if (showCamera) {
        stopCamera();
      }
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setShowCamera(true);
      
      // Get video element and set the stream
      const videoElement = document.getElementById('camera-preview') as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    const videoElement = document.getElementById('camera-preview') as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          // Create a File object from the blob
          const file = new File([blob], `proof_${Date.now()}.png`, { type: 'image/png' });
          setProofImage(file);
          
          // Create preview URL
          const previewUrl = URL.createObjectURL(blob);
          setProofPreview(previewUrl);
          
          // Stop the camera
          stopCamera();
        }
      }, 'image/png');
    }
  };

  const uploadProofImage = async () => {
    if (!proofImage || !order) {
      alert('Please capture or select an image first');
      return;
    }
    
    try {
      setLoadingProof(true);
      
      // Create file path in the "proof" folder
      const fileExt = proofImage.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `proof/${fileName}`;
      
      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('case-assets')
        .upload(filePath, proofImage);
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Update order with proof image URL
      const { error: updateError } = await supabase
        .from('orders')
        .update({ proof_image_url: filePath })
        .eq('id', order.id);
      
      if (updateError) {
        throw updateError;
      }
      
      // Update local state
      setOrder({ ...order, proof_image_url: filePath });
      setSuccessMessage('Proof image uploaded successfully');
      
      // Reload order details to get updated data
      fetchOrderDetails();
    } catch (error: any) {
      console.error('Error uploading proof image:', error);
      setError(error.message || 'Failed to upload proof image');
    } finally {
      setLoadingProof(false);
    }
  };

  const createGHNOrder = async () => {
    if (!order) return;
    
    if (!order.proof_image_url) {
      alert('Please upload proof image before creating GHN order');
      return;
    }
    
    try {
      setCreatingGHN(true);
      
      // Extract province, district, and ward from shipping address
      const addressParts = order.shipping_address.split(', ');
      const provinceName = addressParts[addressParts.length - 1];
      const districtName = addressParts[addressParts.length - 2];
      const wardName = addressParts[addressParts.length - 3];
      
      // Get province, district, and ward IDs from GHN
      const provinces = await GHNService.getProvinces();
      const province = provinces.find((p: any) => p.ProvinceName === provinceName);
      
      if (!province) {
        throw new Error(`Province not found: ${provinceName}`);
      }
      
      const districts = await GHNService.getDistricts(province.ProvinceID);
      const district = districts.find((d: any) => d.DistrictName === districtName);
      
      if (!district) {
        throw new Error(`District not found: ${districtName}`);
      }
      
      const wards = await GHNService.getWards(district.DistrictID);
      const ward = wards.find((w: any) => w.WardName === wardName);
      
      if (!ward) {
        throw new Error(`Ward not found: ${wardName}`);
      }
      
      // Calculate total weight (in grams) - assume 100g per case
      const weight = orderItems.reduce((total, item) => total + ((item.quantity || 1) * 100), 0);
      
      // Convert prices from USD to VND (approximate exchange rate)
      const totalInVND = Math.round(Number(order.total) * 23000);
      const subtotalInVND = Math.round(Number(order.subtotal) * 23000);
      
      // Prepare shipping order data for GHN
      const shippingData = {
        orderId: order.id,
        shop_id: Number(import.meta.env.VITE_GHN_SHOP_ID || 0),
        to_name: order.full_name,
        to_phone: order.phone_number,
        to_address: order.shipping_address,
        to_ward_code: ward.WardCode,
        to_district_id: district.DistrictID,
        from_district_id: Number(import.meta.env.VITE_GHN_DISTRICT_ID || 1454), // Shop district
        weight: Math.max(weight, 100), // Minimum 100g
        length: 20,
        width: 10,
        height: 5,
        payment_type_id: order.payment_method === 'cod' ? 2 : 1, // 2 for COD, 1 for pre-paid
        service_id: 53320, // Standard delivery service
        service_type_id: 2, // Standard service
        required_note: 'CHOTHUHANG', // Allow checking goods before accepting
        cod_amount: order.payment_method === 'cod' ? totalInVND : 0, // COD amount in VND
        insurance_value: subtotalInVND, // Insure value in VND
        note: order.notes || 'Xin nhẹ tay',
        items: orderItems.map(item => ({
          name: item.inventory_items?.phone_models?.name 
            ? `${item.inventory_items.phone_models.name} - ${item.inventory_items.case_types?.name || 'Case'}`
            : 'Sản phẩm',
          quantity: item.quantity || 1,
          price: Math.round((item.price || 0) * 23000)
        }))
      };
      
      // Create shipping order in GHN
      const ghnResponse = await GHNService.createOrder(shippingData);
      
      if (!ghnResponse || !ghnResponse.order_code) {
        throw new Error('Failed to create GHN order. No order code returned.');
      }
      
      // Update order in database
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          has_ghn_order: true,
          ghn_code: ghnResponse.order_code,
          status: 'processing' // Update order status to processing
        })
        .eq('id', order.id);
      
      if (updateError) {
        throw updateError;
      }
      
      // Update local state
      setOrder({
        ...order,
        has_ghn_order: true,
        ghn_code: ghnResponse.order_code,
        status: 'processing'
      });
      
      setSuccessMessage('GHN shipping order created successfully');
      
      // Reload order details to get updated data
      fetchOrderDetails();
    } catch (error: any) {
      console.error('Error creating GHN order:', error);
      setError(error.message || 'Failed to create GHN shipping order');
    } finally {
      setCreatingGHN(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white p-6 rounded-lg">
        <div className="text-red-500 flex items-center mb-4">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error || 'Order not found'}
        </div>
        <button
          onClick={() => navigate('/admin/orders')}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            {successMessage}
          </div>
          <button onClick={() => setSuccessMessage(null)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Order #{orderId?.slice(0, 8)}</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/orders')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            Back to Orders
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Order Info */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Order Information</h3>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <dl className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-gray-600">Status:</dt>
                <dd className="col-span-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    order.status === 'completed' ? 'bg-green-100 text-green-800' :
                    order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {order.status}
                  </span>
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-gray-600">Created:</dt>
                <dd className="col-span-2">{formatDate(order.created_at)}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-gray-600">Total:</dt>
                <dd className="col-span-2 font-semibold">${order.total.toFixed(2)}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-gray-600">Payment:</dt>
                <dd className="col-span-2">
                  {order.payment_method === 'cod' ? 'Cash on Delivery' : 'VNPAY'}
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                    order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-gray-600">GHN Status:</dt>
                <dd className="col-span-2">
                  {order.has_ghn_order ? (
                    <div>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">Created</span>
                      {order.ghn_code && <span className="ml-2 text-sm text-gray-600">Code: {order.ghn_code}</span>}
                    </div>
                  ) : (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">Not Created</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          
          <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <dl className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-gray-600">Name:</dt>
                <dd className="col-span-2">{order.full_name}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-gray-600">Phone:</dt>
                <dd className="col-span-2">{order.phone_number}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-gray-600">Email:</dt>
                <dd className="col-span-2">{order.email || 'Not provided'}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <dt className="text-gray-600">Address:</dt>
                <dd className="col-span-2">{order.shipping_address}</dd>
              </div>
              {order.notes && (
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-gray-600">Notes:</dt>
                  <dd className="col-span-2">{order.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        
        {/* Order Items and Proof Image */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Order Items</h3>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <ul className="divide-y">
              {orderItems.map((item) => (
                <li key={item.id} className="py-3 flex items-start gap-4">
                  <div className="h-16 w-16 flex-shrink-0">
                    {item.mockup_design_url ? (
                      <img 
                        src={getImageUrl(item.mockup_design_url)} 
                        alt="Product mockup" 
                        className="h-16 w-16 object-contain rounded"
                      />
                    ) : item.custom_design_url ? (
                      <img 
                        src={getImageUrl(item.custom_design_url)} 
                        alt="Custom design" 
                        className="h-16 w-16 object-contain rounded"
                      />
                    ) : (
                      <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {item.inventory_items?.phone_models?.name} - {item.inventory_items?.case_types?.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Quantity: {item.quantity} × ${item.price.toFixed(2)}
                    </div>
                    <div className="text-sm font-medium mt-1">
                      ${(item.quantity * item.price).toFixed(2)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Shipping:</span>
                <span>${order.shipping_fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-2 border-t">
                <span>Total:</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <h3 className="text-lg font-semibold mb-4">Proof of Completion</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            {/* Proof Image Display */}
            {order.proof_image_url ? (
              <div className="mb-4">
                <div className="aspect-square max-h-60 w-full bg-white rounded-lg overflow-hidden">
                  <img 
                    src={getImageUrl(order.proof_image_url)} 
                    alt="Proof of completion" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-sm text-center mt-2 text-gray-600">
                  Proof image uploaded
                </p>
              </div>
            ) : proofPreview ? (
              <div className="mb-4">
                <div className="aspect-square max-h-60 w-full bg-white rounded-lg overflow-hidden">
                  <img 
                    src={proofPreview} 
                    alt="Proof preview" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-sm text-center mt-2 text-gray-600">
                  Preview (not uploaded yet)
                </p>
              </div>
            ) : (
              <div className="aspect-square max-h-60 w-full bg-white rounded-lg flex items-center justify-center mb-4">
                <div className="text-center text-gray-500">
                  <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p>No proof image uploaded</p>
                </div>
              </div>
            )}

            {/* Camera Preview */}
            {showCamera && (
              <div className="mb-4">
                <div className="aspect-square max-h-60 w-full bg-black rounded-lg overflow-hidden">
                  <video 
                    id="camera-preview" 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  ></video>
                </div>
                <div className="flex justify-center mt-2">
                  <button
                    onClick={capturePhoto}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Capture Photo
                  </button>
                  <button
                    onClick={stopCamera}
                    className="ml-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Proof Upload Controls */}
            {!order.has_ghn_order && (
              <div className="mt-4">
                {!showCamera && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={startCamera}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      disabled={loadingProof}
                    >
                      <Camera className="w-4 h-4" />
                      Take Photo
                    </button>
                    
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={loadingProof}
                      />
                    </label>
                    
                    {proofImage && !order.proof_image_url && (
                      <button
                        onClick={uploadProofImage}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        disabled={loadingProof}
                      >
                        {loadingProof ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                            Uploading...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Save Proof Image
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                )}
                
                {/* GHN Order Creation */}
                {order.proof_image_url && !order.has_ghn_order && (
                  <button
                    onClick={createGHNOrder}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    disabled={creatingGHN}
                  >
                    {creatingGHN ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Creating GHN Order...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <TruckIcon className="w-5 h-5" />
                        Create GHN Shipping Order
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
            
            {/* GHN Order Status */}
            {order.has_ghn_order && (
              <div className="mt-4 p-4 bg-green-50 text-green-800 rounded-lg">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle className="w-5 h-5" />
                  GHN shipping order created
                </div>
                {order.ghn_code && (
                  <p className="mt-1 text-sm">Order Code: {order.ghn_code}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 