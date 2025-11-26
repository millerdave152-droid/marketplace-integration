-- Migration: Add Best Buy Marketplace (Mirakl) Integration Tables
-- Description: Adds marketplace-specific columns and tables for order/inventory management
-- Date: 2025-11-26

-- ============================================================
-- 1. ALTER products table to add marketplace fields
-- ============================================================

ALTER TABLE products
ADD COLUMN IF NOT EXISTS mirakl_sku VARCHAR(100),
ADD COLUMN IF NOT EXISTS mirakl_offer_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS bestbuy_category_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_mirakl_sku ON products(mirakl_sku);
CREATE INDEX IF NOT EXISTS idx_products_mirakl_offer_id ON products(mirakl_offer_id);
CREATE INDEX IF NOT EXISTS idx_products_last_synced_at ON products(last_synced_at);

-- ============================================================
-- 2. CREATE marketplace_orders table
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id SERIAL PRIMARY KEY,
  mirakl_order_id VARCHAR(100) UNIQUE NOT NULL,
  order_state VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255),
  shipping_address JSONB,
  order_lines JSONB NOT NULL,
  total_price INTEGER NOT NULL, -- stored in cents
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  shipped_at TIMESTAMP,
  CONSTRAINT chk_total_price_positive CHECK (total_price >= 0)
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_mirakl_order_id ON marketplace_orders(mirakl_order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_order_state ON marketplace_orders(order_state);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_created_at ON marketplace_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_accepted_at ON marketplace_orders(accepted_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_shipped_at ON marketplace_orders(shipped_at);

-- Add comment for documentation
COMMENT ON TABLE marketplace_orders IS 'Stores orders received from Best Buy Marketplace via Mirakl API';
COMMENT ON COLUMN marketplace_orders.total_price IS 'Total price in cents';
COMMENT ON COLUMN marketplace_orders.order_lines IS 'JSON array of order line items';
COMMENT ON COLUMN marketplace_orders.shipping_address IS 'JSON object containing customer shipping details';

-- ============================================================
-- 3. CREATE marketplace_shipments table
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_shipments (
  id SERIAL PRIMARY KEY,
  marketplace_order_id INTEGER NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  mirakl_shipment_id VARCHAR(100),
  tracking_number VARCHAR(100) NOT NULL,
  carrier_code VARCHAR(50) NOT NULL,
  shipped_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_tracking_number_not_empty CHECK (tracking_number <> ''),
  CONSTRAINT chk_carrier_code_not_empty CHECK (carrier_code <> '')
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_shipments_order_id ON marketplace_shipments(marketplace_order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_shipments_tracking_number ON marketplace_shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_marketplace_shipments_shipped_at ON marketplace_shipments(shipped_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_shipments_mirakl_shipment_id ON marketplace_shipments(mirakl_shipment_id);

-- Add comment for documentation
COMMENT ON TABLE marketplace_shipments IS 'Tracks shipments for marketplace orders';
COMMENT ON COLUMN marketplace_shipments.marketplace_order_id IS 'References marketplace_orders.id';

-- ============================================================
-- 4. CREATE marketplace_sync_log table
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_sync_log (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  CONSTRAINT chk_status_valid CHECK (status IN ('pending', 'running', 'success', 'failed', 'partial')),
  CONSTRAINT chk_sync_type_valid CHECK (sync_type IN ('offers', 'orders', 'shipments', 'inventory', 'full')),
  CONSTRAINT chk_records_processed_nonnegative CHECK (records_processed >= 0)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_sync_log_sync_type ON marketplace_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_sync_log_status ON marketplace_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_sync_log_started_at ON marketplace_sync_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_sync_log_completed_at ON marketplace_sync_log(completed_at DESC);

-- Add comment for documentation
COMMENT ON TABLE marketplace_sync_log IS 'Logs all marketplace synchronization operations for monitoring and debugging';
COMMENT ON COLUMN marketplace_sync_log.sync_type IS 'Type of sync: offers, orders, shipments, inventory, or full';
COMMENT ON COLUMN marketplace_sync_log.status IS 'Status: pending, running, success, failed, or partial';

-- ============================================================
-- Migration Complete
-- ============================================================

-- Display summary
DO $$
BEGIN
  RAISE NOTICE '✅ Marketplace tables migration completed successfully';
  RAISE NOTICE '   - Products table altered with marketplace columns';
  RAISE NOTICE '   - marketplace_orders table created';
  RAISE NOTICE '   - marketplace_shipments table created';
  RAISE NOTICE '   - marketplace_sync_log table created';
  RAISE NOTICE '   - All indexes and constraints applied';
END $$;
