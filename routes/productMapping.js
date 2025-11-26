const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * Product Mapping Routes
 * Manages mapping of internal products to Best Buy Marketplace (Mirakl)
 */

// ============================================================
// GET /api/product-mapping - Get all products with mapping fields
// ============================================================
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        sku,
        name,
        price,
        quantity,
        mirakl_sku,
        mirakl_offer_id,
        bestbuy_category_id,
        last_synced_at
      FROM products
      ORDER BY id ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      products: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('❌ Error fetching products for mapping:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================
// GET /api/product-mapping/unmapped - Get only unmapped products
// ============================================================
router.get('/unmapped', async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        sku,
        name,
        price,
        quantity,
        mirakl_sku,
        mirakl_offer_id,
        bestbuy_category_id,
        last_synced_at
      FROM products
      WHERE mirakl_sku IS NULL
      ORDER BY id ASC
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      products: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error('❌ Error fetching unmapped products:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================
// PUT /api/product-mapping/:id - Update single product mapping
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { mirakl_sku, bestbuy_category_id } = req.body;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID',
      });
    }

    // Check if product exists
    const checkResult = await pool.query(
      'SELECT id FROM products WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Update product
    const updateQuery = `
      UPDATE products
      SET
        mirakl_sku = $1,
        bestbuy_category_id = $2
      WHERE id = $3
      RETURNING
        id,
        sku,
        name,
        price,
        quantity,
        mirakl_sku,
        mirakl_offer_id,
        bestbuy_category_id,
        last_synced_at
    `;

    const updateResult = await pool.query(updateQuery, [
      mirakl_sku || null,
      bestbuy_category_id || null,
      id,
    ]);

    console.log(`✅ Updated product mapping for ID ${id}`);

    res.json({
      success: true,
      product: updateResult.rows[0],
    });
  } catch (error) {
    console.error('❌ Error updating product mapping:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================
// POST /api/product-mapping/bulk - Bulk update product mappings
// ============================================================
router.post('/bulk', async (req, res) => {
  const client = await pool.connect();

  try {
    const { products } = req.body;

    // Validate input
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input: products array is required',
      });
    }

    console.log(`📦 Bulk updating ${products.length} product mappings...`);

    // Begin transaction
    await client.query('BEGIN');

    let updated = 0;
    const errors = [];

    for (const product of products) {
      try {
        const { id, mirakl_sku, bestbuy_category_id } = product;

        // Validate product ID
        if (!id || isNaN(parseInt(id))) {
          errors.push({ id, error: 'Invalid product ID' });
          continue;
        }

        // Update product
        const updateQuery = `
          UPDATE products
          SET
            mirakl_sku = $1,
            bestbuy_category_id = $2
          WHERE id = $3
        `;

        const result = await client.query(updateQuery, [
          mirakl_sku || null,
          bestbuy_category_id || null,
          id,
        ]);

        if (result.rowCount > 0) {
          updated++;
        } else {
          errors.push({ id, error: 'Product not found' });
        }
      } catch (error) {
        errors.push({ id: product.id, error: error.message });
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ Bulk update completed: ${updated} products updated`);

    res.json({
      success: true,
      updated,
      total: products.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');

    console.error('❌ Error in bulk product mapping update:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

// ============================================================
// GET /api/product-mapping/stats - Get mapping statistics
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(*) as total_products,
        COUNT(mirakl_sku) as mapped_products,
        COUNT(*) - COUNT(mirakl_sku) as unmapped_products,
        COUNT(CASE WHEN last_synced_at IS NOT NULL THEN 1 END) as synced_products
      FROM products
    `;

    const result = await pool.query(statsQuery);
    const stats = result.rows[0];

    res.json({
      success: true,
      stats: {
        total: parseInt(stats.total_products),
        mapped: parseInt(stats.mapped_products),
        unmapped: parseInt(stats.unmapped_products),
        synced: parseInt(stats.synced_products),
      },
    });
  } catch (error) {
    console.error('❌ Error fetching mapping stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================
// DELETE /api/product-mapping/:id - Clear mapping for a product
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID',
      });
    }

    // Clear mapping fields
    const updateQuery = `
      UPDATE products
      SET
        mirakl_sku = NULL,
        mirakl_offer_id = NULL,
        bestbuy_category_id = NULL,
        last_synced_at = NULL
      WHERE id = $1
      RETURNING id, sku, name
    `;

    const result = await pool.query(updateQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    console.log(`🗑️  Cleared mapping for product ID ${id}`);

    res.json({
      success: true,
      product: result.rows[0],
    });
  } catch (error) {
    console.error('❌ Error clearing product mapping:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
