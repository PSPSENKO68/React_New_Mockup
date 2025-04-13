import { Request, Response } from 'express';
import GHNService from '../../src/lib/ghnService';

/**
 * API endpoint để đồng bộ hóa trạng thái đơn hàng từ GHN
 * Có thể gọi thủ công hoặc chạy theo lịch trình để cập nhật trạng thái đơn hàng
 */
export async function syncGHNOrders(req: Request, res: Response) {
  try {
    console.log('Received request to sync GHN orders');
    
    // Đồng bộ hóa trạng thái đơn hàng
    const result = await GHNService.syncOrderStatuses();
    
    console.log('GHN order sync completed', result);
    
    return res.status(200).json({
      ...result
    });
  } catch (error: any) {
    console.error('Error syncing GHN orders:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * API endpoint để đánh dấu một đơn hàng cụ thể là đã hủy
 */
export async function cancelOrder(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }
    
    console.log(`Received request to cancel order: ${orderId}`);
    
    // Đánh dấu đơn hàng đã hủy
    const result = await GHNService.markOrderAsCancelled(orderId);
    
    return res.status(200).json({
      ...result
    });
  } catch (error: any) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
} 