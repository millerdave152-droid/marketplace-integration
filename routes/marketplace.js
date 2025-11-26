const express = require('express');
const router = express.Router();
const pool = require('../db');
const miraklService = require('../services/miraklService');

/**
 * Best Buy Marketplace (Mirakl) Routes
 * Handles product sync, order management, and shipments
 */

// ============================================================
// POST /sync-offers - Sync products to Mirakl
// ============================================================
router.post('/sync-offers', async (req, res) => {
  const startTime = new Date();
  let syncLogId = null;

  try {
    console.log('🔄 Starting offer sync...');

    // Create sync log entry
    const logResult = await pool.query(
      `INSERT INTO marketplace_sync_log (sync_type, status, started_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['offers', 'running', startTime]
    );
    syncLogId = logResult.rows[0].id;

    // Query products with Mirakl SKUs
    const productsResult = await pool.query(
      `SELECT id, mirakl_sku, mirakl_offer_id, price, quantity, description
       FROM products
       WHERE mirakl_sku IS NOT NULL`
    );

    const products = productsResult.rows;

    if (products.length === 0) {
      await pool.query(
        `UPDATE marketplace_sync_log
         SET status = $1, completed_at = $2, records_processed = $3
         WHERE id = $4`,
        ['success', new Date(), 0, syncLogId]
      );

      return res.json({
        success: true,
        synced: 0,
        message: 'No products with Mirakl SKU found'
      });
    }

    // Sync offers to Mirakl
    await miraklService.syncOffers(products);

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

    console.log(`✅ Successfully synced ${products.length} offers`);

    res.json({
      success: true,
      synced: products.length,
      message: `${products.length} offers synced successfully`
    });

  } catch (error) {
    console.error('❌ Offer sync failed:', error);

    // Update sync log with failure
    if (syncLogId) {
      await pool.query(
        `UPDATE marketplace_sync_log
         SET status = $1, completed_at = $2, error_message = $3
         WHERE id = $4`,
        ['failed', new Date(), error.message, syncLogId]
      ).catch(err => console.error('Failed to update sync log:', err));
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// GET /pull-orders - Fetch orders from Mirakl and store in DB
// ============================================================
router.get('/pull-orders', async (req, res) => {
  const startTime = new Date();
  let syncLogId = null;

  try {
    console.log('📥 Pulling orders from Mirakl...');

    // Create sync log entry
    const logResult = await pool.query(
      `INSERT INTO marketplace_sync_log (sync_type, status, started_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['orders', 'running', startTime]
    );
    syncLogId = logResult.rows[0].id;

    // Get last order sync time
    const lastSyncResult = await pool.query(
      `SELECT completed_at
       FROM marketplace_sync_log
       WHERE sync_type = 'orders' AND status = 'success'
       ORDER BY completed_at DESC
       LIMIT 1`
    );

    const lastUpdated = lastSyncResult.rows[0]?.completed_at || null;

    // Fetch orders from Mirakl
    const orders = await miraklService.fetchOrders(lastUpdated);

    if (orders.length === 0) {
      await pool.query(
        `UPDATE marketplace_sync_log
         SET status = $1, completed_at = $2, records_processed = $3
         WHERE id = $4`,
        ['success', new Date(), 0, syncLogId]
      );

      return res.json({
        success: true,
        imported: 0,
        message: 'No new orders found'
      });
    }

    // Insert/Update orders in database
    let importedCount = 0;

    for (const order of orders) {
      // Convert total price from dollars to cents
      const totalPriceCents = miraklService.dollarsToCents(order.total_price || 0);

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

      importedCount++;
    }

    // Update sync log with success
    await pool.query(
      `UPDATE marketplace_sync_log
       SET status = $1, completed_at = $2, records_processed = $3
       WHERE id = $4`,
      ['success', new Date(), importedCount, syncLogId]
    );

    console.log(`✅ Successfully imported ${importedCount} orders`);

    res.json({
      success: true,
      imported: importedCount,
      message: `${importedCount} orders imported successfully`
    });

  } catch (error) {
    console.error('❌ Order pull failed:', error);

    // Update sync log with failure
    if (syncLogId) {
      await pool.query(
        `UPDATE marketplace_sync_log
         SET status = $1, completed_at = $2, error_message = $3
         WHERE id = $4`,
        ['failed', new Date(), error.message, syncLogId]
      ).catch(err => console.error('Failed to update sync log:', err));
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// GET /orders - List all marketplace orders
// ============================================================
router.get('/orders', async (req, res) => {
  try {
    const { state, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT *
      FROM marketplace_orders
    `;
    const params = [];
    let paramIndex = 1;

    // Filter by order_state if provided
    if (state) {
      query += ` WHERE order_state = $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    // Add pagination
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM marketplace_orders';
    const countParams = [];

    if (state) {
      countQuery += ' WHERE order_state = $1';
      countParams.push(state);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      orders: result.rows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.rows.length < totalCount
      }
    });

  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// GET /orders/:id - Get single order with shipments
// ============================================================
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get order
    const orderResult = await pool.query(
      'SELECT * FROM marketplace_orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Get shipments for this order
    const shipmentsResult = await pool.query(
      `SELECT * FROM marketplace_shipments
       WHERE marketplace_order_id = $1
       ORDER BY shipped_at DESC`,
      [id]
    );

    res.json({
      success: true,
      order: {
        ...order,
        shipments: shipmentsResult.rows
      }
    });

  } catch (error) {
    console.error('❌ Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// POST /orders/:id/accept - Accept an order
// ============================================================
router.post('/orders/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;

    // Get order from database
    const orderResult = await pool.query(
      'SELECT * FROM marketplace_orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check if already accepted
    if (order.accepted_at) {
      return res.status(400).json({
        success: false,
        error: 'Order already accepted'
      });
    }

    // Parse order lines
    const orderLines = order.order_lines;

    // Accept order via Mirakl API
    await miraklService.acceptOrder(order.mirakl_order_id, orderLines);

    // Update order in database
    const updateResult = await pool.query(
      `UPDATE marketplace_orders
       SET order_state = $1, accepted_at = $2
       WHERE id = $3
       RETURNING *`,
      ['SHIPPING', new Date(), id]
    );

    console.log(`✅ Order ${order.mirakl_order_id} accepted`);

    res.json({
      success: true,
      order: updateResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Error accepting order:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// POST /orders/:id/ship - Create shipment for an order
// ============================================================
router.post('/orders/:id/ship', async (req, res) => {
  try {
    const { id } = req.params;
    const { trackingNumber, carrierCode } = req.body;

    // Validate input
    if (!trackingNumber || !carrierCode) {
      return res.status(400).json({
        success: false,
        error: 'trackingNumber and carrierCode are required'
      });
    }

    // Get order from database
    const orderResult = await pool.query(
      'SELECT * FROM marketplace_orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const order = orderResult.rows[0];

    // Check if already shipped
    if (order.shipped_at) {
      return res.status(400).json({
        success: false,
        error: 'Order already shipped'
      });
    }

    // Parse order lines
    const orderLines = order.order_lines;

    // Create shipment via Mirakl API
    const shipmentResponse = await miraklService.createShipment(
      order.mirakl_order_id,
      trackingNumber,
      carrierCode,
      orderLines
    );

    // Update order shipped_at timestamp
    await pool.query(
      `UPDATE marketplace_orders
       SET shipped_at = $1, order_state = $2
       WHERE id = $3`,
      [new Date(), 'SHIPPED', id]
    );

    // Insert shipment record
    const shipmentResult = await pool.query(
      `INSERT INTO marketplace_shipments (
        marketplace_order_id,
        mirakl_shipment_id,
        tracking_number,
        carrier_code,
        shipped_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        id,
        shipmentResponse.shipment_id || null,
        trackingNumber,
        carrierCode,
        new Date()
      ]
    );

    console.log(`✅ Shipment created for order ${order.mirakl_order_id}`);

    res.json({
      success: true,
      shipment: shipmentResult.rows[0]
    });

  } catch (error) {
    console.error('❌ Error creating shipment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// GET /sync-status - Get sync status and pending order counts
// ============================================================
router.get('/sync-status', async (req, res) => {
  try {
    // Get last sync times for OFFERS and ORDERS
    const syncStatusResult = await pool.query(
      `SELECT
        sync_type,
        MAX(completed_at) as last_sync,
        MAX(started_at) as last_started,
        (SELECT status FROM marketplace_sync_log msl2
         WHERE msl2.sync_type = msl.sync_type
         ORDER BY started_at DESC LIMIT 1) as last_status
       FROM marketplace_sync_log msl
       WHERE sync_type IN ('offers', 'orders')
         AND status IN ('success', 'failed')
       GROUP BY sync_type`
    );

    const syncStatus = {};
    syncStatusResult.rows.forEach(row => {
      syncStatus[row.sync_type] = {
        lastSync: row.last_sync,
        lastStarted: row.last_started,
        lastStatus: row.last_status
      };
    });

    // Count pending orders
    const pendingOrdersResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM marketplace_orders
       WHERE order_state IN ('WAITING_ACCEPTANCE', 'SHIPPING')`
    );

    const pendingOrders = parseInt(pendingOrdersResult.rows[0].count);

    // Count orders by state
    const ordersByStateResult = await pool.query(
      `SELECT order_state, COUNT(*) as count
       FROM marketplace_orders
       GROUP BY order_state`
    );

    const ordersByState = {};
    ordersByStateResult.rows.forEach(row => {
      ordersByState[row.order_state] = parseInt(row.count);
    });

    res.json({
      success: true,
      syncStatus,
      pendingOrders,
      ordersByState
    });

  } catch (error) {
    console.error('❌ Error fetching sync status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
