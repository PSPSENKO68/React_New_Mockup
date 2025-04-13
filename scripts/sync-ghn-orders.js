/**
 * Script để đồng bộ hóa trạng thái đơn hàng từ GHN
 * Chạy bằng cách gọi: node scripts/sync-ghn-orders.js
 */

const { GHNService } = require('../src/lib/ghnService');

async function syncOrders() {
  console.log('Starting GHN order synchronization...');
  
  try {
    const result = await GHNService.syncOrderStatuses();
    
    console.log('Synchronization completed:');
    console.log(`Total orders: ${result.total}`);
    console.log(`Successfully synced: ${result.successCount}`);
    console.log(`Failed: ${result.failedCount}`);
    
    if (result.results && result.results.length > 0) {
      console.log('\nResults:');
      result.results.forEach(r => {
        if (r.success) {
          console.log(`✅ Order ${r.orderCode} (${r.orderId}): ${r.originalStatus} → ${r.mappedStatus}`);
        } else {
          console.log(`❌ Order ${r.orderCode} (${r.orderId}): Failed - ${r.error}`);
        }
      });
    }
  } catch (error) {
    console.error('Error during synchronization:', error);
  }
  
  process.exit(0);
}

syncOrders(); 