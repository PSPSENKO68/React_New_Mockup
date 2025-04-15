import { supabase } from './supabase';

/**
 * Giảm số lượng sản phẩm trong kho sau khi đơn hàng được tạo
 * @param orderId - ID của đơn hàng
 * @returns Promise với kết quả cập nhật
 */
export async function decreaseInventoryOnOrderCreation(orderId: string) {
  try {
    // Lấy thông tin đơn hàng
    const { data: orderItems, error: fetchError } = await supabase
      .from('order_items')
      .select(`
        id, 
        quantity, 
        inventory_item_id
      `)
      .eq('order_id', orderId);

    if (fetchError) throw fetchError;
    if (!orderItems || orderItems.length === 0) return { success: false, message: 'Không tìm thấy sản phẩm trong đơn hàng' };

    // Cập nhật số lượng sản phẩm cho từng mục
    const updates = [];
    
    for (const item of orderItems) {
      if (!item.inventory_item_id) continue;
      
      // Lấy thông tin tồn kho hiện tại
      const { data: inventoryItem, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('quantity')
        .eq('id', item.inventory_item_id)
        .single();
      
      if (inventoryError) {
        console.error(`Lỗi khi lấy thông tin tồn kho cho sản phẩm ${item.inventory_item_id}:`, inventoryError);
        continue;
      }
      
      if (!inventoryItem) continue;
      
      // Tính toán số lượng mới
      const newQuantity = Math.max(0, inventoryItem.quantity - item.quantity);
      
      // Cập nhật trong cơ sở dữ liệu
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ quantity: newQuantity })
        .eq('id', item.inventory_item_id);
      
      if (updateError) {
        console.error(`Lỗi khi cập nhật tồn kho cho sản phẩm ${item.inventory_item_id}:`, updateError);
        continue;
      }
      
      updates.push({
        itemId: item.inventory_item_id,
        oldQuantity: inventoryItem.quantity,
        newQuantity: newQuantity,
        orderQuantity: item.quantity
      });
    }
    
    console.log('Đã cập nhật tồn kho sau khi tạo đơn hàng:', updates);
    
    return {
      success: true, 
      message: `Đã cập nhật ${updates.length} sản phẩm trong kho`, 
      updates
    };
  } catch (error: any) {
    console.error('Lỗi khi giảm tồn kho:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Tăng số lượng sản phẩm trong kho khi đơn hàng bị hủy
 * @param orderId - ID của đơn hàng
 * @returns Promise với kết quả cập nhật
 */
export async function increaseInventoryOnOrderCancellation(orderId: string) {
  try {
    // Lấy thông tin đơn hàng
    const { data: orderItems, error: fetchError } = await supabase
      .from('order_items')
      .select(`
        id, 
        quantity, 
        inventory_item_id
      `)
      .eq('order_id', orderId);

    if (fetchError) throw fetchError;
    if (!orderItems || orderItems.length === 0) return { success: false, message: 'Không tìm thấy sản phẩm trong đơn hàng' };

    // Cập nhật số lượng sản phẩm cho từng mục
    const updates = [];
    
    for (const item of orderItems) {
      if (!item.inventory_item_id) continue;
      
      // Lấy thông tin tồn kho hiện tại
      const { data: inventoryItem, error: inventoryError } = await supabase
        .from('inventory_items')
        .select('quantity')
        .eq('id', item.inventory_item_id)
        .single();
      
      if (inventoryError) {
        console.error(`Lỗi khi lấy thông tin tồn kho cho sản phẩm ${item.inventory_item_id}:`, inventoryError);
        continue;
      }
      
      if (!inventoryItem) continue;
      
      // Tính toán số lượng mới
      const newQuantity = inventoryItem.quantity + item.quantity;
      
      // Cập nhật trong cơ sở dữ liệu
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ quantity: newQuantity })
        .eq('id', item.inventory_item_id);
      
      if (updateError) {
        console.error(`Lỗi khi cập nhật tồn kho cho sản phẩm ${item.inventory_item_id}:`, updateError);
        continue;
      }
      
      updates.push({
        itemId: item.inventory_item_id,
        oldQuantity: inventoryItem.quantity,
        newQuantity: newQuantity,
        orderQuantity: item.quantity
      });
    }
    
    console.log('Đã cập nhật tồn kho sau khi hủy đơn hàng:', updates);
    
    return {
      success: true, 
      message: `Đã cập nhật ${updates.length} sản phẩm trong kho`, 
      updates
    };
  } catch (error: any) {
    console.error('Lỗi khi tăng tồn kho:', error);
    return { success: false, message: error.message };
  }
} 