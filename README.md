# Best Buy Marketplace (Mirakl) Integration Module

This module provides a complete integration with Best Buy Marketplace using the Mirakl API for a PERN stack application. It handles product sync, order management, shipment tracking, and automated background jobs.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [File Integration Steps](#file-integration-steps)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required npm Packages

Install the following dependencies:

```bash
npm install axios node-cron dotenv
```

**Package Breakdown:**
- `axios` - HTTP client for Mirakl API calls
- `node-cron` - Job scheduler for automated syncs
- `dotenv` - Environment variable management

### Existing Requirements

Your PERN app should already have:
- `express` - Web framework
- `pg` - PostgreSQL database client
- A configured PostgreSQL database
- A database connection pool (typically in `db.js` or `config/database.js`)

---

## Environment Variables

Add the following variables to your `.env` file:

### Required Variables

```env
# Mirakl API Configuration
MIRAKL_API_URL=https://bestbuy-us.mirakl.net
MIRAKL_API_KEY=your_api_key_here
MIRAKL_SHOP_ID=your_shop_id
```

### Optional Variables

```env
# Sync Configuration (optional)
MIRAKL_SYNC_INTERVAL=60                # Inventory sync interval in minutes
MIRAKL_ORDER_SYNC_INTERVAL=15          # Order pull interval in minutes
MIRAKL_DEFAULT_LEADTIME=2              # Default shipping leadtime in days
MIRAKL_MIN_QUANTITY_ALERT=5            # Low inventory alert threshold
MIRAKL_AUTO_ACCEPT_ORDERS=false        # Auto-accept orders (true/false)
```

### How to Get Credentials

1. **MIRAKL_API_URL**:
   - Production: `https://bestbuy-us.mirakl.net`
   - Sandbox: `https://bestbuy-us-sandbox.mirakl.net`

2. **MIRAKL_API_KEY**:
   - Login to Best Buy Marketplace Seller Portal
   - Navigate to: Settings → API Keys
   - Generate or copy your API key

3. **MIRAKL_SHOP_ID**:
   - Found in: Seller Portal → Account Settings → Shop Information
   - Your unique seller identifier

**Important:** Copy `config/env.example` to `.env` and fill in your actual credentials. Never commit `.env` to version control.

---

## Database Setup

### Running the Migration

Execute the SQL migration to add marketplace tables and columns:

#### Option 1: Using psql Command Line

```bash
psql -U your_username -d your_database -f migrations/add_marketplace_tables.sql
```

Replace:
- `your_username` - Your PostgreSQL username
- `your_database` - Your database name

#### Option 2: Using pgAdmin or Database GUI

1. Open your PostgreSQL GUI tool
2. Connect to your database
3. Open and execute `migrations/add_marketplace_tables.sql`

#### Option 3: Using Node.js Script

Create a migration runner script:

```javascript
// scripts/run-migrations.js
const fs = require('fs');
const pool = require('./db');

async function runMigration() {
  const sql = fs.readFileSync('./migrations/add_marketplace_tables.sql', 'utf8');
  await pool.query(sql);
  console.log('✅ Migration completed successfully');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
```

Run it:
```bash
node scripts/run-migrations.js
```

### What Gets Created

The migration creates:

**Modified Tables:**
- `products` - Adds marketplace columns: `mirakl_sku`, `mirakl_offer_id`, `bestbuy_category_id`, `last_synced_at`

**New Tables:**
- `marketplace_orders` - Stores orders from Best Buy Marketplace
- `marketplace_shipments` - Tracks shipment information
- `marketplace_sync_log` - Logs all sync operations for monitoring

---

## File Integration Steps

### Step 1: Copy Module Files

Copy these files to your existing PERN app:

```
your-app/
├── services/
│   └── miraklService.js          ← Copy here
├── routes/
│   └── marketplace.js             ← Copy here
├── jobs/
│   ├── marketplaceJobs.js         ← Copy here
│   └── scheduler.js               ← Copy here
├── migrations/
│   └── add_marketplace_tables.sql ← Copy here
└── config/
    └── env.example                ← Copy here (reference only)
```

### Step 2: Update Import Paths (If Needed)

Ensure import paths match your project structure:

**In `routes/marketplace.js`:**
```javascript
const pool = require('../db'); // Adjust to your db pool location
const miraklService = require('../services/miraklService');
```

**In `jobs/marketplaceJobs.js`:**
```javascript
const pool = require('../db'); // Adjust to your db pool location
const miraklService = require('../services/miraklService');
```

### Step 3: Register Routes in server.js

Add these lines to your main server file (usually `server.js` or `app.js`):

```javascript
// Import marketplace routes
const marketplaceRoutes = require('./routes/marketplace');

// Register routes (after other middleware, before error handlers)
app.use('/api/marketplace', marketplaceRoutes);
```

**Full Example:**
```javascript
const express = require('express');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Your existing routes
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));

// Marketplace routes
const marketplaceRoutes = require('./routes/marketplace');
app.use('/api/marketplace', marketplaceRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 4: Start the Scheduler

Add the scheduler to your server startup:

```javascript
const express = require('express');
const { startScheduler } = require('./jobs/scheduler');
require('dotenv').config();

const app = express();

// ... your middleware and routes ...

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Start marketplace background jobs
  startScheduler();
});
```

**What This Does:**
- Starts automated inventory sync every 30 minutes
- Starts automated order pull every 15 minutes
- Only runs if `MIRAKL_API_KEY` is configured

### Step 5: Verify Installation

Start your server and check the console output:

```bash
npm start
```

You should see:
```
Server running on port 5000
🚀 Starting Marketplace Job Scheduler...
✅ Scheduled: Inventory Sync Job - Every 30 minutes
✅ Scheduled: Order Pull Job - Every 15 minutes
📅 Marketplace jobs are now running on schedule.
```

---

## API Endpoints Reference

### Base URL
All endpoints are prefixed with `/api/marketplace`

---

### 1. Sync Offers

Sync product catalog to Best Buy Marketplace.

**Endpoint:** `POST /api/marketplace/sync-offers`

**Request Body:** None (queries products from database)

**Response:**
```json
{
  "success": true,
  "synced": 25,
  "message": "25 offers synced successfully"
}
```

**Use Case:** Manually trigger inventory sync to Mirakl

---

### 2. Pull Orders

Fetch new orders from Best Buy Marketplace.

**Endpoint:** `GET /api/marketplace/pull-orders`

**Query Parameters:** None

**Response:**
```json
{
  "success": true,
  "imported": 5,
  "message": "5 orders imported successfully"
}
```

**Use Case:** Manually fetch latest orders from Mirakl

---

### 3. List Orders

Get all marketplace orders with optional filtering.

**Endpoint:** `GET /api/marketplace/orders`

**Query Parameters:**
- `state` (optional) - Filter by order state (e.g., "WAITING_ACCEPTANCE", "SHIPPING", "SHIPPED")
- `limit` (optional) - Number of results per page (default: 50)
- `offset` (optional) - Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "id": 1,
      "mirakl_order_id": "ORD-12345",
      "order_state": "WAITING_ACCEPTANCE",
      "customer_name": "John Doe",
      "shipping_address": { "street": "123 Main St", "city": "New York" },
      "order_lines": [...],
      "total_price": 9999,
      "created_at": "2025-11-26T10:00:00.000Z",
      "accepted_at": null,
      "shipped_at": null
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 4. Get Order Details

Get single order with shipments.

**Endpoint:** `GET /api/marketplace/orders/:id`

**Path Parameters:**
- `id` - Order ID (database ID, not Mirakl order ID)

**Response:**
```json
{
  "success": true,
  "order": {
    "id": 1,
    "mirakl_order_id": "ORD-12345",
    "order_state": "SHIPPED",
    "customer_name": "John Doe",
    "total_price": 9999,
    "shipments": [
      {
        "id": 1,
        "tracking_number": "1Z999AA1234567890",
        "carrier_code": "UPS",
        "shipped_at": "2025-11-26T15:00:00.000Z"
      }
    ]
  }
}
```

---

### 5. Accept Order

Accept a pending order.

**Endpoint:** `POST /api/marketplace/orders/:id/accept`

**Path Parameters:**
- `id` - Order ID

**Request Body:** None

**Response:**
```json
{
  "success": true,
  "order": {
    "id": 1,
    "mirakl_order_id": "ORD-12345",
    "order_state": "SHIPPING",
    "accepted_at": "2025-11-26T10:30:00.000Z"
  }
}
```

---

### 6. Ship Order

Create a shipment for an order.

**Endpoint:** `POST /api/marketplace/orders/:id/ship`

**Path Parameters:**
- `id` - Order ID

**Request Body:**
```json
{
  "trackingNumber": "1Z999AA1234567890",
  "carrierCode": "UPS"
}
```

**Carrier Codes:**
- `UPS` - UPS
- `USPS` - US Postal Service
- `FEDEX` - FedEx
- `DHL` - DHL

**Response:**
```json
{
  "success": true,
  "shipment": {
    "id": 1,
    "marketplace_order_id": 1,
    "mirakl_shipment_id": "SHIP-789",
    "tracking_number": "1Z999AA1234567890",
    "carrier_code": "UPS",
    "shipped_at": "2025-11-26T15:00:00.000Z"
  }
}
```

---

### 7. Sync Status

Get sync status and pending order counts.

**Endpoint:** `GET /api/marketplace/sync-status`

**Response:**
```json
{
  "success": true,
  "syncStatus": {
    "offers": {
      "lastSync": "2025-11-26T10:00:00.000Z",
      "lastStarted": "2025-11-26T10:00:00.000Z",
      "lastStatus": "success"
    },
    "orders": {
      "lastSync": "2025-11-26T10:15:00.000Z",
      "lastStarted": "2025-11-26T10:15:00.000Z",
      "lastStatus": "success"
    }
  },
  "pendingOrders": 5,
  "ordersByState": {
    "WAITING_ACCEPTANCE": 3,
    "SHIPPING": 2,
    "SHIPPED": 10
  }
}
```

---

## Testing

### Using Mirakl Sandbox

1. **Update Environment Variables**

```env
MIRAKL_API_URL=https://bestbuy-us-sandbox.mirakl.net
MIRAKL_API_KEY=your_sandbox_api_key
MIRAKL_SHOP_ID=your_sandbox_shop_id
```

2. **Create Test Products**

Ensure your products table has test data with `mirakl_sku` populated:

```sql
UPDATE products
SET mirakl_sku = sku,
    bestbuy_category_id = '12345'
WHERE id IN (1, 2, 3);
```

### Sample cURL Commands

#### 1. Sync Offers

```bash
curl -X POST http://localhost:5000/api/marketplace/sync-offers \
  -H "Content-Type: application/json"
```

#### 2. Pull Orders

```bash
curl -X GET http://localhost:5000/api/marketplace/pull-orders
```

#### 3. List All Orders

```bash
curl -X GET http://localhost:5000/api/marketplace/orders
```

#### 4. Filter Orders by State

```bash
curl -X GET "http://localhost:5000/api/marketplace/orders?state=WAITING_ACCEPTANCE&limit=10"
```

#### 5. Get Order Details

```bash
curl -X GET http://localhost:5000/api/marketplace/orders/1
```

#### 6. Accept Order

```bash
curl -X POST http://localhost:5000/api/marketplace/orders/1/accept \
  -H "Content-Type: application/json"
```

#### 7. Ship Order

```bash
curl -X POST http://localhost:5000/api/marketplace/orders/1/ship \
  -H "Content-Type: application/json" \
  -d '{
    "trackingNumber": "1Z999AA1234567890",
    "carrierCode": "UPS"
  }'
```

#### 8. Get Sync Status

```bash
curl -X GET http://localhost:5000/api/marketplace/sync-status
```

### Testing with Postman

Import this collection to Postman:

1. Create a new environment with:
   - `base_url`: `http://localhost:5000`

2. Use the endpoints listed above

3. Test the full order workflow:
   - Sync offers → Pull orders → Accept order → Ship order

---

## Troubleshooting

### Scheduler Not Starting

**Problem:** Background jobs not running

**Solution:**
- Check if `MIRAKL_API_KEY` is set in `.env`
- Verify `startScheduler()` is called in `server.js`
- Check console output for error messages

### Database Connection Errors

**Problem:** "Cannot find module '../db'"

**Solution:**
- Update import paths in `routes/marketplace.js` and `jobs/marketplaceJobs.js`
- Ensure your database pool is properly exported

### Migration Fails

**Problem:** SQL syntax errors or permission denied

**Solution:**
- Ensure PostgreSQL user has CREATE TABLE permissions
- Check if tables already exist (use `DROP TABLE IF EXISTS` if re-running)
- Verify database connection is working

### API Returns 500 Error

**Problem:** "Mirakl API credentials not configured"

**Solution:**
- Verify all three environment variables are set: `MIRAKL_API_URL`, `MIRAKL_API_KEY`, `MIRAKL_SHOP_ID`
- Restart your server after updating `.env`
- Check API key is valid and not expired

### Orders Not Syncing

**Problem:** `pullOrdersJob()` returns 0 orders

**Solution:**
- Verify you have orders in Best Buy Marketplace Seller Portal
- Check order states match the filter: `WAITING_ACCEPTANCE`, `SHIPPING`, `SHIPPED`, `TO_COLLECT`
- Test with sandbox environment first
- Check `marketplace_sync_log` table for error messages

### Price Discrepancies

**Problem:** Prices appear incorrect

**Solution:**
- Remember: Database stores prices in **cents**, Mirakl uses **dollars**
- Verify conversion functions are being called correctly
- Check `miraklService.centsToDollars()` and `miraklService.dollarsToCents()`

---

## Manual Job Execution

You can manually trigger jobs without waiting for scheduled runs:

```javascript
const { runJobManually } = require('./jobs/scheduler');

// In a route or script
app.post('/admin/run-sync', async (req, res) => {
  const result = await runJobManually('inventory-sync');
  res.json(result);
});

app.post('/admin/run-orders', async (req, res) => {
  const result = await runJobManually('order-pull');
  res.json(result);
});
```

---

## Next Steps

1. **Set up products** - Ensure `mirakl_sku` is populated for products you want to sync
2. **Test in sandbox** - Use Best Buy sandbox environment before production
3. **Monitor logs** - Check `marketplace_sync_log` table regularly
4. **Customize schedules** - Adjust cron timings in `scheduler.js` if needed
5. **Add error alerts** - Integrate email/SMS notifications for failed syncs
6. **Build admin UI** - Create frontend dashboard for order management

---

## Support

For issues with:
- **Mirakl API**: Contact Best Buy Marketplace support
- **Integration Module**: Review code comments and error logs
- **Database Issues**: Check PostgreSQL logs

---

## License

ISC
