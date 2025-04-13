import { supabase } from '../lib/supabase';

/**
 * Hàm di chuyển file từ thư mục temp sang thư mục order trong supabase storage
 * Sử dụng khi người dùng đặt hàng thành công
 * 
 * @param userId ID người dùng (từ cookie)
 * @returns Danh sách đường dẫn mới của các file đã được di chuyển
 */
export async function moveFilesFromTempToOrder(userId: string): Promise<{success: boolean, newPaths: string[]}> {
  try {
    // Liệt kê các file trong thư mục temp
    const { data: files, error: listError } = await supabase.storage
      .from('case-assets')
      .list(`temp/${userId}`);
    
    if (listError) {
      console.error('Error listing temp files:', listError);
      return { success: false, newPaths: [] };
    }
    
    if (!files || files.length === 0) {
      console.log('No files to move for user:', userId);
      return { success: true, newPaths: [] };
    }
    
    console.log(`Found ${files.length} files to move for user ${userId} to order folder`);
    
    const newPaths: string[] = [];
    
    // Đối với mỗi file, thực hiện quy trình copy và delete
    for (const file of files) {
      const sourcePath = `temp/${userId}/${file.name}`;
      // Sử dụng userId thay vì orderId cho thư mục đích
      const destPath = `order/${userId}/${file.name}`;
      
      // 1. Tải file từ thư mục temp
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('case-assets')
        .download(sourcePath);
      
      if (downloadError) {
        console.error(`Error downloading file ${sourcePath}:`, downloadError);
        continue;
      }
      
      // 2. Upload file lên thư mục order
      const { error: uploadError } = await supabase.storage
        .from('case-assets')
        .upload(destPath, fileData, {
          contentType: file.metadata?.mimetype || 'image/png',
          upsert: true
        });
      
      if (uploadError) {
        console.error(`Error uploading file to ${destPath}:`, uploadError);
        continue;
      }
      
      // 3. Xóa file từ thư mục temp
      const { error: deleteError } = await supabase.storage
        .from('case-assets')
        .remove([sourcePath]);
      
      if (deleteError) {
        console.error(`Error deleting temp file ${sourcePath}:`, deleteError);
        // Không dừng quy trình vì file đã được sao chép thành công
      }
      
      // 4. Thêm đường dẫn mới vào danh sách kết quả
      newPaths.push(destPath);
      
      console.log(`Successfully moved ${sourcePath} to ${destPath}`);
    }
    
    return {
      success: true,
      newPaths
    };
  } catch (error) {
    console.error('Error moving files from temp to order:', error);
    return {
      success: false,
      newPaths: []
    };
  }
}

/**
 * Cập nhật đường dẫn file trong order_items
 * @param orderId ID đơn hàng
 * @param oldPath Đường dẫn cũ của file (temp/...)
 * @param newPath Đường dẫn mới của file (order/...)
 */
export async function updateOrderItemFilePaths(orderId: string, oldPath: string, newPath: string): Promise<boolean> {
  try {
    // Cập nhật các đường dẫn custom_design_url
    const { error: customError } = await supabase
      .from('order_items')
      .update({ custom_design_url: newPath })
      .eq('order_id', orderId)
      .eq('custom_design_url', oldPath);
    
    if (customError) {
      console.error('Error updating custom_design_url:', customError);
    }
    
    // Cập nhật các đường dẫn mockup_design_url
    const { error: mockupError } = await supabase
      .from('order_items')
      .update({ mockup_design_url: newPath })
      .eq('order_id', orderId)
      .eq('mockup_design_url', oldPath);
    
    if (mockupError) {
      console.error('Error updating mockup_design_url:', mockupError);
    }
    
    return !customError && !mockupError;
  } catch (error) {
    console.error('Error updating order item file paths:', error);
    return false;
  }
} 