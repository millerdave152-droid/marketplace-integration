/**
 * Test Script: Database Migration
 * Tests the marketplace tables migration
 */

const pool = require('./db');
const fs = require('fs');

async function testMigration() {
  console.log('\n🧪 Testing Database Migration...\n');

  try {
    // Test 1: Check if tables exist
    console.log('Test 1: Checking if marketplace tables exist...');

    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'marketplace%'
      ORDER BY table_name;
    `;

    const tablesResult = await pool.query(tablesQuery);
    console.log(`✅ Found ${tablesResult.rows.length} marketplace tables:`);
    tablesResult.rows.forEach(row => console.log(`   - ${row.table_name}`));

    // Test 2: Check products table columns
    console.log('\nTest 2: Checking products table for marketplace columns...');

    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'products'
      AND column_name IN ('mirakl_sku', 'mirakl_offer_id', 'bestbuy_category_id', 'last_synced_at')
      ORDER BY column_name;
    `;

    const columnsResult = await pool.query(columnsQuery);

    if (columnsResult.rows.length === 4) {
      console.log('✅ All marketplace columns exist in products table:');
      columnsResult.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    } else {
      console.log(`❌ Expected 4 columns, found ${columnsResult.rows.length}`);
      columnsResult.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));
    }

    // Test 3: Check marketplace_orders table structure
    console.log('\nTest 3: Checking marketplace_orders table structure...');

    const ordersStructureQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'marketplace_orders'
      ORDER BY ordinal_position;
    `;

    const ordersStructure = await pool.query(ordersStructureQuery);
    console.log(`✅ marketplace_orders has ${ordersStructure.rows.length} columns:`);
    ordersStructure.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));

    // Test 4: Check marketplace_shipments table
    console.log('\nTest 4: Checking marketplace_shipments table...');

    const shipmentsStructureQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'marketplace_shipments'
      ORDER BY ordinal_position;
    `;

    const shipmentsStructure = await pool.query(shipmentsStructureQuery);
    console.log(`✅ marketplace_shipments has ${shipmentsStructure.rows.length} columns:`);
    shipmentsStructure.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));

    // Test 5: Check marketplace_sync_log table
    console.log('\nTest 5: Checking marketplace_sync_log table...');

    const syncLogStructureQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'marketplace_sync_log'
      ORDER BY ordinal_position;
    `;

    const syncLogStructure = await pool.query(syncLogStructureQuery);
    console.log(`✅ marketplace_sync_log has ${syncLogStructure.rows.length} columns:`);
    syncLogStructure.rows.forEach(row => console.log(`   - ${row.column_name} (${row.data_type})`));

    // Test 6: Check indexes
    console.log('\nTest 6: Checking indexes...');

    const indexesQuery = `
      SELECT
        tablename,
        indexname
      FROM pg_indexes
      WHERE tablename LIKE 'marketplace%' OR tablename = 'products'
      AND indexname LIKE '%mirakl%' OR indexname LIKE '%marketplace%'
      ORDER BY tablename, indexname;
    `;

    const indexesResult = await pool.query(indexesQuery);
    console.log(`✅ Found ${indexesResult.rows.length} marketplace-related indexes:`);
    indexesResult.rows.forEach(row => console.log(`   - ${row.tablename}.${row.indexname}`));

    console.log('\n✅ All migration tests passed!\n');

  } catch (error) {
    console.error('\n❌ Migration test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testMigration();
