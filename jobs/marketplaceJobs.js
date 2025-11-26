const pool = require('../db');
const miraklService = require('../services/miraklService');

/**
 * Marketplace Background Jobs
 * Scheduled tasks for inventory sync and order processing
 */

/**
 * Sync Inventory Job
 * Syncs all products with Mirakl SKUs to Best Buy Marketplace
 */
async function syncInventoryJob() {
  const startTime = new Date();
  let syncLogId = null;

  console.log(`\n⏰ [${startTime.toISOString()}] Starting inventory sync job...`);

  try {
    // Create sync log entry
    const logResult = await pool.query(
      `INSERT INTO marketplace_sync_log (sync_type, status, started_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['offers', 'running', startTime]
    );
    syncLogId = logResult.rows[0].id;

    // Query all products with Mirakl SKUs
    const productsResult = await pool.query(
      `SELECT id, mirakl_sku, mirakl_offer_id, price, quantity, description,
              name, sku
       FROM products
       WHERE mirakl_sku IS NOT NULL
       ORDER BY id`
    );

    const products = productsResult.rows;

    if (products.length === 0) {
      console.log('ℹ️  No products with Mirakl SKU found. Skipping sync.');

      await pool.query(
        `UPDATE marketplace_sync_log
         SET status = $1, completed_at = $2, records_processed = $3
         WHERE id = $4`,
        ['success', new Date(), 0, syncLogId]
      );

      return {
        success: true,
        synced: 0,
        message: 'No products to sync'
      };
    }

    console.log(`📦 Found ${products.length} products to sync`);

    // Sync offers to Mirakl
    const syncResult = await miraklService.syncOffers(products);

    // Update last_synced_at for all synced products
    const productIds = products.map(p => p.id);
    await pool.query(
      `UPDATE products
       SET last_synced_at = $1
       WHERE id = ANY($2)`,
      [new Date(), productIds]
    );

    // Update sync log with success
    await pool.query(
      `UPDATE marketplace_sync_log
       SET status = $1, completed_at = $2, records_processed = $3
       WHERE id = $4`,
      ['success', new Date(), products.length, syncLogId]
    );

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`✅ [${endTime.toISOString()}] Inventory sync completed successfully`);
    console.log(`   - Products synced: ${products.length}`);
    console.log(`   - Duration: ${duration}s\n`);

    return {
      success: true,
      synced: products.length,
      duration,
      startTime,
      endTime
    };

  } catch (error) {
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.error(`❌ [${endTime.toISOString()}] Inventory sync failed:`, error.message);
    console.error(`   - Duration: ${duration}s\n`);

    // Update sync log with failure
    if (syncLogId) {
      try {
        await pool.query(
          `UPDATE marketplace_sync_log
           SET status = $1, completed_at = $2, error_message = $3
           WHERE id = $4`,
          ['failed', new Date(), error.message, syncLogId]
        );
      } catch (logError) {
        console.error('Failed to update sync log:', logError.message);
      }
    }

    return {
      success: false,
      error: error.message,
      duration,
      startTime,
      endTime
    };
  }
}

/**
 * Pull Orders Job
 * Fetches new orders from Best Buy Marketplace and stores them in database
 */
async function pullOrdersJob() {
  const startTime = new Date();
  let syncLogId = null;

  console.log(`\n⏰ [${startTime.toISOString()}] Starting order pull job...`);

  try {
    // Create sync log entry
    const logResult = await pool.query(
      `INSERT INTO marketplace_sync_log (sync_type, status, started_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['orders', 'running', startTime]
    );
    syncLogId = logResult.rows[0].id;

    // Get last successful order sync time for incremental sync
    const lastSyncResult = await pool.query(
      `SELECT completed_at
       FROM marketplace_sync_log
       WHERE sync_type = 'orders' AND status = 'success'
       ORDER BY completed_at DESC
       LIMIT 1`
    );

    const lastUpdated = lastSyncResult.rows[0]?.completed_at || null;

    if (lastUpdated) {
      console.log(`📅 Fetching orders updated since: ${lastUpdated.toISOString()}`);
    } else {
      console.log('📅 Fetching all orders (first sync)');
    }

    // Fetch orders from Mirakl
    const orders = await miraklService.fetchOrders(lastUpdated);

    if (orders.length === 0) {
      console.log('ℹ️  No new orders found.');

      await pool.query(
        `UPDATE marketplace_sync_log
         SET status = $1, completed_at = $2, records_processed = $3
         WHERE id = $4`,
        ['success', new Date(), 0, syncLogId]
      );

      const endTime = new Date();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      console.log(`✅ [${endTime.toISOString()}] Order pull completed`);
      console.log(`   - Orders imported: 0`);
      console.log(`   - Duration: ${duration}s\n`);

      return {
        success: true,
        imported: 0,
        duration,
        startTime,
        endTime
      };
    }

    console.log(`📥 Processing ${orders.length} orders...`);

    // Process and store orders in database
    let importedCount = 0;
    let updatedCount = 0;

    for (const order of orders) {
      try {
        // Convert total price from dollars to cents
        const totalPriceCents = miraklService.dollarsToCents(order.total_price || 0);

        // Check if order already exists
        const existingOrder = await pool.query(
          'SELECT id FROM marketplace_orders WHERE mirakl_order_id = $1',
          [order.order_id]
        );

        const isUpdate = existingOrder.rows.length > 0;

        // Insert or update order
        await pool.query(
          `INSERT INTO marketplace_orders (
            mirakl_order_id,
            order_state,
            customer_name,
            shipping_address,
            order_lines,
            total_price,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (mirakl_order_id)
          DO UPDATE SET
            order_state = EXCLUDED.order_state,
            customer_name = EXCLUDED.customer_name,
            shipping_address = EXCLUDED.shipping_address,
            order_lines = EXCLUDED.order_lines,
            total_price = EXCLUDED.total_price`,
          [
            order.order_id,
            order.order_state,
            order.customer?.firstname && order.customer?.lastname
              ? `${order.customer.firstname} ${order.customer.lastname}`
              : 'N/A',
            JSON.stringify(order.customer?.shipping_address || {}),
            JSON.stringify(order.order_lines || []),
            totalPriceCents,
            order.created_date || new Date()
          ]
        );

        if (isUpdate) {
          updatedCount++;
        } else {
          importedCount++;
        }

      } catch (orderError) {
        console.error(`❌ Error processing order ${order.order_id}:`, orderError.message);
        // Continue processing other orders
      }
    }

    const totalProcessed = importedCount + updatedCount;

    // Update sync log with success
    await pool.query(
      `UPDATE marketplace_sync_log
       SET status = $1, completed_at = $2, records_processed = $3
       WHERE id = $4`,
      ['success', new Date(), totalProcessed, syncLogId]
    );

    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`✅ [${endTime.toISOString()}] Order pull completed successfully`);
    console.log(`   - New orders: ${importedCount}`);
    console.log(`   - Updated orders: ${updatedCount}`);
    console.log(`   - Total processed: ${totalProcessed}`);
    console.log(`   - Duration: ${duration}s\n`);

    return {
      success: true,
      imported: importedCount,
      updated: updatedCount,
      total: totalProcessed,
      duration,
      startTime,
      endTime
    };

  } catch (error) {
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.error(`❌ [${endTime.toISOString()}] Order pull failed:`, error.message);
    console.error(`   - Duration: ${duration}s\n`);

    // Update sync log with failure
    if (syncLogId) {
      try {
        await pool.query(
          `UPDATE marketplace_sync_log
           SET status = $1, completed_at = $2, error_message = $3
           WHERE id = $4`,
          ['failed', new Date(), error.message, syncLogId]
        );
      } catch (logError) {
        console.error('Failed to update sync log:', logError.message);
      }
    }

    return {
      success: false,
      error: error.message,
      duration,
      startTime,
      endTime
    };
  }
}

module.exports = {
  syncInventoryJob,
  pullOrdersJob
};
