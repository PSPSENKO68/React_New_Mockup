import { Request, Response } from 'express';
import { supabase } from '../../src/lib/supabase';
import GHNService from '../../src/lib/ghnService';

/**
 * API lấy danh sách tỉnh/thành phố
 */
export async function getProvinces(req: Request, res: Response) {
  try {
    const provinces = await GHNService.getProvinces();
    return res.status(200).json({ success: true, data: provinces });
  } catch (error: any) {
    console.error('Error fetching provinces:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * API lấy danh sách quận/huyện theo tỉnh/thành phố
 */
export async function getDistricts(req: Request, res: Response) {
  try {
    const { provinceId } = req.params;
    
    if (!provinceId) {
      return res.status(400).json({ success: false, message: 'Province ID is required' });
    }
    
    const districts = await GHNService.getDistricts(Number(provinceId));
    return res.status(200).json({ success: true, data: districts });
  } catch (error: any) {
    console.error('Error fetching districts:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * API lấy danh sách phường/xã theo quận/huyện
 */
export async function getWards(req: Request, res: Response) {
  try {
    const { districtId } = req.params;
    
    if (!districtId) {
      return res.status(400).json({ success: false, message: 'District ID is required' });
    }
    
    const wards = await GHNService.getWards(Number(districtId));
    return res.status(200).json({ success: true, data: wards });
  } catch (error: any) {
    console.error('Error fetching wards:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * API tính phí giao hàng
 */
export async function calculateShippingFee(req: Request, res: Response) {
  try {
    const { toDistrictId, toWardCode, weight, length, width, height, insuranceValue } = req.body;
    
    if (!toDistrictId || !toWardCode || !weight) {
      return res.status(400).json({ 
        success: false, 
        message: 'toDistrictId, toWardCode and weight are required'
      });
    }
    
    const fee = await GHNService.calculateShippingFee({
      fromDistrictId: Number(process.env.VITE_GHN_DISTRICT_ID || 0),
      toDistrictId: Number(toDistrictId),
      toWardCode,
      weight: Number(weight),
      length: length ? Number(length) : undefined,
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      insuranceValue: insuranceValue ? Number(insuranceValue) : undefined
    });
    
    return res.status(200).json({ success: true, data: fee });
  } catch (error: any) {
    console.error('Error calculating shipping fee:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * API tạo đơn hàng
 */
export async function createOrder(req: Request, res: Response) {
  try {
    const {
      orderId,
      toName,
      toPhone,
      toAddress,
      toWardCode,
      toDistrictId,
      weight,
      length,
      width,
      height,
      cod,
      insuranceValue,
      note,
      service_id = 53320, // Default service ID for standard delivery
      payment_type_id = 2 // Default to COD
    } = req.body;
    
    // Validate required fields
    if (!orderId || !toName || !toPhone || !toAddress || !toWardCode || !toDistrictId || !weight) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    // Get shop_id from GHN config
    const ghnConfig = require('../../src/lib/ghnConfig').default();
    const shop_id = typeof ghnConfig.shopId === 'string' ? parseInt(ghnConfig.shopId, 10) : ghnConfig.shopId;
    
    // Tạo đơn hàng trên GHN
    const result = await GHNService.createOrder({
      shop_id,
      orderId,
      to_name: toName,
      to_phone: toPhone,
      to_address: toAddress,
      to_ward_code: toWardCode,
      to_district_id: Number(toDistrictId),
      weight: Number(weight),
      length: Number(length || 15),
      width: Number(width || 15),
      height: Number(height || 10),
      service_id: Number(service_id),
      payment_type_id: Number(payment_type_id),
      cod_amount: Number(cod || 0),
      insurance_value: Number(insuranceValue || 0),
      note
    });
    
    // Cập nhật trạng thái đơn hàng
    await supabase
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', orderId);
    
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error creating GHN order:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * API hủy đơn hàng
 */
export async function cancelOrder(req: Request, res: Response) {
  try {
    const { orderId, orderCode } = req.body;
    
    if (!orderCode) {
      return res.status(400).json({ success: false, message: 'GHN order code is required' });
    }
    
    // Hủy đơn hàng trên GHN
    const result = await GHNService.cancelOrder(orderCode);
    
    // Cập nhật trạng thái đơn hàng
    if (orderId) {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
    }
    
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error cancelling GHN order:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * API lấy thông tin chi tiết đơn hàng
 */
export async function getOrderInfo(req: Request, res: Response) {
  try {
    const { orderCode } = req.params;
    
    if (!orderCode) {
      return res.status(400).json({ success: false, message: 'GHN order code is required' });
    }
    
    const result = await GHNService.getOrderInfo(orderCode);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error getting GHN order info:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * API lấy URL theo dõi đơn hàng
 */
export async function getTrackingUrl(req: Request, res: Response) {
  try {
    const { orderCode } = req.params;
    
    if (!orderCode) {
      return res.status(400).json({ success: false, message: 'GHN order code is required' });
    }
    
    const trackingUrl = GHNService.getTrackingUrl(orderCode);
    return res.status(200).json({ success: true, data: { trackingUrl } });
  } catch (error: any) {
    console.error('Error getting tracking URL:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
} 