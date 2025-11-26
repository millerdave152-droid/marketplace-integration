/**
 * Test Server: Marketplace Routes
 * Runs a test server to verify all marketplace endpoints
 */

require('dotenv').config();
const express = require('express');
const marketplaceRoutes = require('./routes/marketplace');

const app = express();
const PORT = process.env.TEST_PORT || 3002;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Test server is running',
    timestamp: new Date().toISOString()
  });
});

// Mount marketplace routes
app.use('/api/marketplace', marketplaceRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n🧪 Test Server Running');
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('\n📚 Available Endpoints:');
  console.log('   GET  /health - Health check');
  console.log('   POST /api/marketplace/sync-offers - Sync offers to Mirakl');
  console.log('   GET  /api/marketplace/pull-orders - Pull orders from Mirakl');
  console.log('   GET  /api/marketplace/orders - List orders');
  console.log('   GET  /api/marketplace/orders/:id - Get order details');
  console.log('   POST /api/marketplace/orders/:id/accept - Accept order');
  console.log('   POST /api/marketplace/orders/:id/ship - Ship order');
  console.log('   GET  /api/marketplace/sync-status - Get sync status');
  console.log('\n✅ Ready for testing! Press Ctrl+C to stop.\n');
});
